import "server-only";
import type { AuthContext } from "@/server/auth";
import type { Agent, LeadListItem, Microsite, ViewingRequest } from "@/lib/types";
import type { EventType, TimelineEvent } from "@/lib/domain/events";
import { check } from "@/server/action-result";
import { decryptToken } from "@/lib/security/tokens";
import { developmentNames, sanitiseSearch } from "./catalogue";
import { MICROSITE_COLUMNS, mapLead, mapMicrosite, mapProperty } from "./mappers";
import { mapViewingRows } from "./viewings";

export async function listAgents(ctx: AuthContext): Promise<Agent[]> {
  const memberships = check(
    await ctx.supabase.from("organisation_memberships").select("user_id, role").eq("organisation_id", ctx.organisation.id),
  ) ?? [];
  const ids = memberships.map((m) => m.user_id as string);
  if (ids.length === 0) return [];
  const profiles = check(await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids)) ?? [];
  return memberships
    .map((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      return {
        id: m.user_id as string,
        name: (p?.full_name as string) || (p?.email as string)?.split("@")[0] || "Team member",
        email: (p?.email as string) ?? null,
        role: m.role as string,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function profileNames(ctx: AuthContext, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (unique.length === 0) return new Map();
  const rows = check(await ctx.supabase.from("profiles").select("id, full_name, email").in("id", unique)) ?? [];
  return new Map(rows.map((r) => [r.id as string, (r.full_name as string) || (r.email as string)?.split("@")[0] || "Team member"]));
}

export interface LeadFilters {
  q?: string;
  status?: string;
  developmentId?: string;
  agentId?: string;
  archived?: boolean;
  sort?: string;
  dir?: string;
  page?: number;
}

export const LEAD_PAGE_SIZE = 20;

const SORT_COLUMNS: Record<string, string> = {
  created: "created_at",
  name: "buyer_name",
  status: "status",
  engagement: "last_engagement_at",
};

export async function listLeads(ctx: AuthContext, filters: LeadFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const sortColumn = SORT_COLUMNS[filters.sort ?? "created"] ?? "created_at";
  const ascending = filters.dir === "asc";

  let query = ctx.supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("organisation_id", ctx.organisation.id)
    .order(sortColumn, { ascending, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * LEAD_PAGE_SIZE, page * LEAD_PAGE_SIZE - 1);

  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.developmentId) query = query.eq("development_id", filters.developmentId);
  if (filters.agentId) query = query.eq("assigned_agent_id", filters.agentId);
  const q = sanitiseSearch(filters.q);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query = digits.length >= 4 ? query.or(`buyer_name.ilike.%${q}%,phone_e164.ilike.%${digits}%`) : query.ilike("buyer_name", `%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = data ?? [];

  const leadIds = rows.map((r) => r.id as string);
  const [devNames, agentNames, microsites] = await Promise.all([
    developmentNames(ctx, rows.map((r) => r.development_id as string)),
    profileNames(ctx, rows.map((r) => r.assigned_agent_id as string | null)),
    leadIds.length
      ? ctx.supabase.from("microsites").select(MICROSITE_COLUMNS).in("lead_id", leadIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const micrositeRows = check(microsites) ?? [];

  const leads: LeadListItem[] = rows.map((r) => {
    const latest = micrositeRows.find((m) => m.lead_id === r.id);
    const ms = latest ? mapMicrosite(latest) : null;
    return {
      ...mapLead(r, { development: devNames.get(r.development_id), agent: agentNames.get(r.assigned_agent_id) ?? null }),
      microsite: ms ? { id: ms.id, state: ms.state, firstOpenedAt: ms.firstOpenedAt } : null,
    };
  });

  return { leads, total: count ?? 0, page, pageSize: LEAD_PAGE_SIZE };
}

export interface SelectedProperty {
  id: string;
  unitReference: string;
  configuration: string;
  developmentName: string;
  price: number | null;
  currency: string;
  availabilityStatus: string;
  archived: boolean;
  matchTier: string;
  snapshotPrice: number | null;
}

export interface LeadDetail {
  lead: ReturnType<typeof mapLead>;
  microsite: (Microsite & { url: string | null; urlError: string | null }) | null;
  micrositeHistory: Microsite[];
  selectedProperties: SelectedProperty[];
  timeline: TimelineEvent[];
  viewings: ViewingRequest[];
}

export async function getLeadDetail(ctx: AuthContext, id: string, siteUrl: string): Promise<LeadDetail | null> {
  const row = check(await ctx.supabase.from("leads").select("*").eq("organisation_id", ctx.organisation.id).eq("id", id).maybeSingle());
  if (!row) return null;

  const [devNames, agentNames, micrositeRows, eventRows, viewingRows] = await Promise.all([
    developmentNames(ctx, [row.development_id]),
    profileNames(ctx, [row.assigned_agent_id]),
    ctx.supabase.from("microsites").select(`${MICROSITE_COLUMNS}, token_ciphertext`).eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.supabase
      .from("engagement_events")
      .select("id, event_type, actor, actor_user_id, property_id, metadata, occurred_at")
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .limit(300),
    ctx.supabase.from("viewing_requests").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);

  const lead = mapLead(row, { development: devNames.get(row.development_id), agent: agentNames.get(row.assigned_agent_id) ?? null });
  const microsites = check(micrositeRows) ?? [];
  const activeRow = microsites.find((m) => !m.revoked_at);

  let microsite: LeadDetail["microsite"] = null;
  let selectedProperties: SelectedProperty[] = [];
  if (activeRow) {
    let url: string | null = null;
    let urlError: string | null = null;
    try {
      url = `${siteUrl}/p/${decryptToken(activeRow.token_ciphertext, process.env.MICROSITE_TOKEN_SECRET)}`;
    } catch {
      urlError = "The link cannot be shown because MICROSITE_TOKEN_SECRET is missing or has changed since it was generated.";
    }
    microsite = { ...mapMicrosite(activeRow), url, urlError };

    const selection = check(
      await ctx.supabase
        .from("microsite_properties")
        .select("property_id, position, match_tier, snapshot")
        .eq("microsite_id", activeRow.id)
        .is("removed_at", null)
        .order("position"),
    ) ?? [];
    const propertyIds = selection.map((s) => s.property_id as string);
    const propertyRows = propertyIds.length
      ? check(await ctx.supabase.from("properties").select("*").in("id", propertyIds)) ?? []
      : [];
    const propNames = await developmentNames(ctx, propertyRows.map((p) => p.development_id as string));
    selectedProperties = selection
      .map((s) => {
        const p = propertyRows.find((x) => x.id === s.property_id);
        if (!p) return null;
        const prop = mapProperty(p, propNames.get(p.development_id) ?? "");
        return {
          id: prop.id,
          unitReference: prop.unitReference,
          configuration: prop.configuration,
          developmentName: prop.developmentName,
          price: prop.price,
          currency: prop.currency,
          availabilityStatus: prop.availabilityStatus,
          archived: Boolean(prop.archivedAt),
          matchTier: s.match_tier as string,
          snapshotPrice: s.snapshot?.price ?? null,
        };
      })
      .filter((x): x is SelectedProperty => x !== null);
  }

  const events = check(eventRows) ?? [];
  const eventPropertyIds = Array.from(new Set(events.map((e) => e.property_id as string | null).filter((x): x is string => Boolean(x))));
  const [eventProps, actorNames] = await Promise.all([
    eventPropertyIds.length
      ? ctx.supabase.from("properties").select("id, unit_reference, configuration").in("id", eventPropertyIds)
      : Promise.resolve({ data: [], error: null }),
    profileNames(ctx, events.map((e) => e.actor_user_id as string | null)),
  ]);
  const propLabels = new Map((check(eventProps) ?? []).map((p) => [p.id as string, `${p.configuration} · ${p.unit_reference}`]));

  const timeline: TimelineEvent[] = events.map((e) => ({
    id: e.id,
    eventType: e.event_type as EventType,
    actor: e.actor,
    actorName: e.actor_user_id ? actorNames.get(e.actor_user_id) ?? null : null,
    propertyLabel: e.property_id ? propLabels.get(e.property_id) ?? null : null,
    metadata: (e.metadata ?? {}) as Record<string, unknown>,
    occurredAt: e.occurred_at,
  }));

  const viewings = await mapViewingRows(ctx, check(viewingRows) ?? []);

  return {
    lead,
    microsite,
    micrositeHistory: microsites.filter((m) => m.id !== activeRow?.id).map(mapMicrosite),
    selectedProperties,
    timeline,
    viewings,
  };
}

export async function getLeadForEdit(ctx: AuthContext, id: string) {
  const row = check(await ctx.supabase.from("leads").select("*").eq("organisation_id", ctx.organisation.id).eq("id", id).maybeSingle());
  if (!row) return null;
  const names = await developmentNames(ctx, [row.development_id]);
  return mapLead(row, { development: names.get(row.development_id) });
}
