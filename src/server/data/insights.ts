import "server-only";
import type { AuthContext } from "@/server/auth";
import type { AppNotification, Microsite } from "@/lib/types";
import type { LeadStatus } from "@/lib/domain/lead-status";
import { LEAD_STATUSES } from "@/lib/domain/lead-status";
import { describeEvent, type EventType } from "@/lib/domain/events";
import { check } from "@/server/action-result";
import { developmentNames, sanitiseSearch } from "./catalogue";
import { MICROSITE_COLUMNS, mapMicrosite } from "./mappers";

export interface AnalyticsSummary {
  totals: {
    rawEvents: number;
    visits: number;
    micrositesOpened: number;
    propertyDetails: number;
    floorPlans: number;
    brochureOpens: number;
    brochurePages: number;
    paymentPlanViews: number;
    whatsappClicks: number;
    viewingRequests: number;
  };
  daily: { date: string; visits: number; events: number }[];
  byDevelopment: { name: string; visits: number; events: number; viewingRequests: number }[];
  byMicrosite: { micrositeId: string; leadId: string; buyerName: string; developmentName: string; visits: number; events: number; lastActivityAt: string }[];
  funnel: { enquiries: number; withMicrosite: number; opened: number; viewingRequested: number; viewingScheduled: number; converted: number };
}

export async function getAnalytics(ctx: AuthContext, from: Date, to: Date): Promise<AnalyticsSummary> {
  const { data, error } = await ctx.supabase.rpc("analytics_summary", {
    p_org: ctx.organisation.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return data as AnalyticsSummary;
}

async function count(promise: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: c, error } = await promise;
  if (error) throw error;
  return c ?? 0;
}

export async function getOverview(ctx: AuthContext, from: Date, to: Date) {
  const org = ctx.organisation.id;
  const sb = ctx.supabase;
  const head = { count: "exact" as const, head: true };
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [totalEnquiries, newEnquiries, micrositesGenerated, viewingRequests, viewingsScheduled, converted, statusRows, analytics] =
    await Promise.all([
      count(sb.from("leads").select("id", head).eq("organisation_id", org).is("archived_at", null).gte("created_at", fromIso).lt("created_at", toIso)),
      count(sb.from("leads").select("id", head).eq("organisation_id", org).is("archived_at", null).eq("status", "new")),
      count(sb.from("microsites").select("id", head).eq("organisation_id", org).gte("created_at", fromIso).lt("created_at", toIso)),
      count(sb.from("viewing_requests").select("id", head).eq("organisation_id", org).gte("created_at", fromIso).lt("created_at", toIso)),
      count(sb.from("viewing_requests").select("id", head).eq("organisation_id", org).in("status", ["confirmed", "rescheduled"]).gte("scheduled_for", new Date().toISOString())),
      count(sb.from("leads").select("id", head).eq("organisation_id", org).eq("status", "converted").gte("updated_at", fromIso).lt("updated_at", toIso)),
      sb.from("leads").select("status").eq("organisation_id", org).is("archived_at", null).limit(5000),
      getAnalytics(ctx, from, to),
    ]);

  const statusCounts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of check(statusRows) ?? []) {
    if (r.status in statusCounts) statusCounts[r.status as LeadStatus] += 1;
  }

  return {
    metrics: {
      totalEnquiries,
      newEnquiries,
      micrositesGenerated,
      visits: analytics.totals.visits,
      viewingRequests,
      viewingsScheduled,
      converted,
    },
    statusCounts,
    funnel: analytics.funnel,
  };
}

export async function getRecentActivity(ctx: AuthContext) {
  const sb = ctx.supabase;
  const org = ctx.organisation.id;
  const [leads, microsites, viewings, events] = await Promise.all([
    sb.from("leads").select("id, buyer_name, configuration, development_id, status, created_at").eq("organisation_id", org).is("archived_at", null).order("created_at", { ascending: false }).limit(6),
    sb.from("microsites").select("id, lead_id, created_at, revoked_at, expires_at, first_opened_at").eq("organisation_id", org).order("created_at", { ascending: false }).limit(6),
    sb.from("viewing_requests").select("id, lead_id, name, scheduled_for, status").eq("organisation_id", org).in("status", ["confirmed", "rescheduled"]).gte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(6),
    sb.from("engagement_events").select("id, lead_id, event_type, metadata, occurred_at").eq("organisation_id", org).eq("actor", "buyer").order("occurred_at", { ascending: false }).limit(8),
  ]);

  const leadRows = check(leads) ?? [];
  const micrositeRows = check(microsites) ?? [];
  const viewingRows = check(viewings) ?? [];
  const eventRows = check(events) ?? [];

  const extraLeadIds = [...micrositeRows, ...viewingRows, ...eventRows].map((r) => r.lead_id as string).filter((id) => !leadRows.some((l) => l.id === id));
  const extraLeads = extraLeadIds.length
    ? check(await sb.from("leads").select("id, buyer_name, development_id").in("id", Array.from(new Set(extraLeadIds)))) ?? []
    : [];
  const allLeads = [...leadRows, ...extraLeads];
  const devNames = await developmentNames(ctx, allLeads.map((l) => l.development_id as string));
  const buyer = (leadId: string) => allLeads.find((l) => l.id === leadId)?.buyer_name ?? "Buyer";

  return {
    recentLeads: leadRows.map((l) => ({
      id: l.id as string,
      buyerName: l.buyer_name as string,
      configuration: l.configuration as string,
      developmentName: devNames.get(l.development_id) ?? "",
      status: l.status as LeadStatus,
      createdAt: l.created_at as string,
    })),
    recentMicrosites: micrositeRows.map((m) => ({
      id: m.id as string,
      leadId: m.lead_id as string,
      buyerName: buyer(m.lead_id),
      state: m.revoked_at ? "revoked" : m.expires_at && new Date(m.expires_at) <= new Date() ? "expired" : "active",
      opened: Boolean(m.first_opened_at),
      createdAt: m.created_at as string,
    })),
    upcomingViewings: viewingRows.map((v) => ({
      id: v.id as string,
      leadId: v.lead_id as string,
      name: v.name as string,
      scheduledFor: v.scheduled_for as string,
      status: v.status as string,
    })),
    latestActivity: eventRows.map((e) => ({
      id: e.id as string,
      leadId: e.lead_id as string,
      buyerName: buyer(e.lead_id),
      description: describeEvent({ eventType: e.event_type as EventType, metadata: e.metadata ?? {}, propertyLabel: null, actorName: null }),
      occurredAt: e.occurred_at as string,
    })),
  };
}

export interface MicrositeListItem extends Microsite {
  buyerName: string;
  developmentName: string;
  propertyCount: number;
}

export async function listMicrosites(ctx: AuthContext, opts: { state?: string; q?: string; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, opts.page ?? 1);
  let query = ctx.supabase
    .from("microsites")
    .select(MICROSITE_COLUMNS, { count: "exact" })
    .eq("organisation_id", ctx.organisation.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const nowIso = new Date().toISOString();
  if (opts.state === "active") query = query.is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (opts.state === "revoked") query = query.not("revoked_at", "is", null);
  if (opts.state === "expired") query = query.is("revoked_at", null).lte("expires_at", nowIso);

  const q = sanitiseSearch(opts.q);
  if (q) {
    const matching = check(
      await ctx.supabase.from("leads").select("id").eq("organisation_id", ctx.organisation.id).ilike("buyer_name", `%${q}%`).limit(200),
    ) ?? [];
    query = query.in("lead_id", matching.length ? matching.map((l) => l.id as string) : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, error, count: total } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const leadIds = Array.from(new Set(rows.map((r) => r.lead_id as string)));
  const micrositeIds = rows.map((r) => r.id as string);

  const [leads, selections] = await Promise.all([
    leadIds.length ? ctx.supabase.from("leads").select("id, buyer_name, development_id").in("id", leadIds) : Promise.resolve({ data: [], error: null }),
    micrositeIds.length
      ? ctx.supabase.from("microsite_properties").select("microsite_id").in("microsite_id", micrositeIds).is("removed_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const leadRows = check(leads) ?? [];
  const selectionRows = check(selections) ?? [];
  const devNames = await developmentNames(ctx, leadRows.map((l) => l.development_id as string));

  const microsites: MicrositeListItem[] = rows.map((r) => {
    const lead = leadRows.find((l) => l.id === r.lead_id);
    return {
      ...mapMicrosite(r),
      buyerName: lead?.buyer_name ?? "Buyer",
      developmentName: lead ? devNames.get(lead.development_id) ?? "" : "",
      propertyCount: selectionRows.filter((s) => s.microsite_id === r.id).length,
    };
  });
  return { microsites, total: total ?? 0, page, pageSize };
}

export async function listNotifications(ctx: AuthContext, limit = 50): Promise<AppNotification[]> {
  const rows = check(
    await ctx.supabase
      .from("notifications")
      .select("id, type, title, body, lead_id, read_at, created_at, email_status")
      .eq("recipient_id", ctx.userId)
      .eq("organisation_id", ctx.organisation.id)
      .order("created_at", { ascending: false })
      .limit(limit),
  ) ?? [];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    leadId: r.lead_id,
    readAt: r.read_at,
    createdAt: r.created_at,
    emailStatus: r.email_status ?? "not_sent",
  }));
}

export async function unreadNotificationCount(ctx: AuthContext): Promise<number> {
  return count(
    ctx.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", ctx.userId)
      .eq("organisation_id", ctx.organisation.id)
      .is("read_at", null),
  );
}
