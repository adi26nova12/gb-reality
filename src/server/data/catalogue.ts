import "server-only";
import type { AuthContext } from "@/server/auth";
import type { Brochure, Development, Property } from "@/lib/types";
import { check } from "@/server/action-result";
import { mapBrochure, mapDevelopment, mapProperty } from "./mappers";

export interface DevelopmentListItem extends Development {
  propertyCount: number;
  availableCount: number;
}

export async function listDevelopments(ctx: AuthContext, opts: { archived?: boolean } = {}): Promise<DevelopmentListItem[]> {
  let query = ctx.supabase.from("developments").select("*").eq("organisation_id", ctx.organisation.id).order("name");
  query = opts.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const rows = check(await query) ?? [];

  const counts = check(
    await ctx.supabase
      .from("properties")
      .select("development_id, availability_status")
      .eq("organisation_id", ctx.organisation.id)
      .is("archived_at", null),
  ) ?? [];

  return rows.map((r) => {
    const mine = counts.filter((c) => c.development_id === r.id);
    return {
      ...mapDevelopment(r),
      propertyCount: mine.length,
      availableCount: mine.filter((c) => c.availability_status === "available").length,
    };
  });
}

export async function developmentOptions(ctx: AuthContext): Promise<{ id: string; name: string }[]> {
  const rows = check(
    await ctx.supabase
      .from("developments")
      .select("id, name")
      .eq("organisation_id", ctx.organisation.id)
      .is("archived_at", null)
      .order("name"),
  );
  return (rows ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));
}

export async function getDevelopment(ctx: AuthContext, id: string) {
  const row = check(
    await ctx.supabase.from("developments").select("*").eq("organisation_id", ctx.organisation.id).eq("id", id).maybeSingle(),
  );
  if (!row) return null;
  const development = mapDevelopment(row);

  const [brochureRows, propertyRows] = await Promise.all([
    ctx.supabase.from("brochure_assets").select("*").eq("development_id", id).eq("organisation_id", ctx.organisation.id).order("created_at", { ascending: false }),
    ctx.supabase.from("properties").select("*").eq("development_id", id).eq("organisation_id", ctx.organisation.id).order("unit_reference"),
  ]);
  const brochures: Brochure[] = (check(brochureRows) ?? []).map(mapBrochure);
  const properties: Property[] = (check(propertyRows) ?? []).map((r) => mapProperty(r, development.name));
  return { development, brochures, properties };
}

export interface PropertyFilters {
  q?: string;
  developmentId?: string;
  configuration?: string;
  availability?: string;
  archived?: boolean;
  page?: number;
}

export const PROPERTY_PAGE_SIZE = 25;

export async function listProperties(ctx: AuthContext, filters: PropertyFilters) {
  const page = Math.max(1, filters.page ?? 1);
  let query = ctx.supabase
    .from("properties")
    .select("*", { count: "exact" })
    .eq("organisation_id", ctx.organisation.id)
    .order("development_id")
    .order("unit_reference")
    .range((page - 1) * PROPERTY_PAGE_SIZE, page * PROPERTY_PAGE_SIZE - 1);
  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filters.developmentId) query = query.eq("development_id", filters.developmentId);
  if (filters.configuration) query = query.eq("configuration", filters.configuration);
  if (filters.availability) query = query.eq("availability_status", filters.availability);
  const q = sanitiseSearch(filters.q);
  if (q) query = query.ilike("unit_reference", `%${q}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  const names = await developmentNames(ctx, (data ?? []).map((r) => r.development_id as string));
  return {
    properties: (data ?? []).map((r) => mapProperty(r, names.get(r.development_id) ?? "")),
    total: count ?? 0,
    page,
    pageSize: PROPERTY_PAGE_SIZE,
  };
}

export async function getProperty(ctx: AuthContext, id: string): Promise<Property | null> {
  const row = check(
    await ctx.supabase.from("properties").select("*").eq("organisation_id", ctx.organisation.id).eq("id", id).maybeSingle(),
  );
  if (!row) return null;
  const names = await developmentNames(ctx, [row.development_id]);
  return mapProperty(row, names.get(row.development_id) ?? "");
}

/** Every non-archived property in the organisation, for deterministic matching. */
export async function listMatchCandidates(ctx: AuthContext): Promise<Property[]> {
  const rows = check(
    await ctx.supabase
      .from("properties")
      .select("*")
      .eq("organisation_id", ctx.organisation.id)
      .is("archived_at", null)
      .limit(2000),
  ) ?? [];
  const names = await developmentNames(ctx, rows.map((r) => r.development_id as string));
  return rows.map((r) => mapProperty(r, names.get(r.development_id) ?? ""));
}

export async function developmentNames(ctx: AuthContext, ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = check(
    await ctx.supabase.from("developments").select("id, name").eq("organisation_id", ctx.organisation.id).in("id", unique),
  ) ?? [];
  return new Map(rows.map((r) => [r.id as string, r.name as string]));
}

/** Keeps search input safe to embed in PostgREST filter strings. */
export function sanitiseSearch(q: string | undefined): string {
  return (q ?? "").replace(/[^\p{L}\p{N} .'+-]/gu, "").trim().slice(0, 80);
}
