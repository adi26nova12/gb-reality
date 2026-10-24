import "server-only";
import type { AuthContext } from "@/server/auth";
import type { ViewingRequest } from "@/lib/types";
import { check } from "@/server/action-result";
import { developmentNames } from "./catalogue";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function mapViewingRows(ctx: AuthContext, rows: Record<string, any>[]): Promise<ViewingRequest[]> {
  if (rows.length === 0) return [];
  const leadIds = Array.from(new Set(rows.map((r) => r.lead_id as string)));
  const propertyIds = Array.from(new Set(rows.map((r) => r.property_id as string | null).filter((x): x is string => Boolean(x))));

  const [leads, properties] = await Promise.all([
    ctx.supabase.from("leads").select("id, buyer_name, development_id").in("id", leadIds),
    propertyIds.length
      ? ctx.supabase.from("properties").select("id, unit_reference, configuration").in("id", propertyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const leadRows = check(leads) ?? [];
  const propRows = check(properties) ?? [];
  const devNames = await developmentNames(ctx, leadRows.map((l) => l.development_id as string));

  return rows.map((r) => {
    const lead = leadRows.find((l) => l.id === r.lead_id);
    const prop = propRows.find((p) => p.id === r.property_id);
    return {
      id: r.id,
      leadId: r.lead_id,
      micrositeId: r.microsite_id,
      buyerName: lead?.buyer_name ?? r.name,
      name: r.name,
      phone: r.phone_e164,
      propertyLabel: prop ? `${prop.configuration} · ${prop.unit_reference}` : null,
      developmentName: lead ? devNames.get(lead.development_id) ?? null : null,
      preferredDate: r.preferred_date,
      preferredTimeRange: r.preferred_time_range,
      message: r.message,
      status: r.status,
      scheduledFor: r.scheduled_for,
      agentNotes: r.agent_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function listViewingRequests(ctx: AuthContext, opts: { status?: string; view?: string; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, opts.page ?? 1);
  let query = ctx.supabase
    .from("viewing_requests")
    .select("*", { count: "exact" })
    .eq("organisation_id", ctx.organisation.id)
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (opts.view === "upcoming") {
    query = query.in("status", ["confirmed", "rescheduled"]).gte("scheduled_for", new Date().toISOString()).order("scheduled_for");
  } else if (opts.view === "open") {
    query = query.in("status", ["requested", "contacted"]).order("created_at", { ascending: false });
  } else {
    if (opts.status) query = query.eq("status", opts.status);
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { requests: await mapViewingRows(ctx, data ?? []), total: count ?? 0, page, pageSize };
}
