import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const ORG_COOKIE = "clannco_org";

export type Role = "owner" | "admin" | "agent";

export interface OrganisationSummary {
  id: string;
  name: string;
  slug: string;
  mediaPrefix: string;
  timezone: string;
  defaultCurrency: string;
  isSample: boolean;
}

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  profile: { fullName: string | null; phone: string | null };
  organisation: OrganisationSummary;
  role: Role;
  preferences: {
    notifyFirstOpen: boolean;
    notifyViewingRequest: boolean;
    notifyContactRequest: boolean;
    notifyEngagement: boolean;
    notifyEmail: boolean;
  };
  organisations: { id: string; name: string; role: Role }[];
}

type LoadResult =
  | { kind: "ok"; ctx: AuthContext }
  | { kind: "unauthenticated" }
  | { kind: "no_membership"; email: string | null };

/**
 * Loads the signed-in user and the organisation they are acting in. The
 * organisation comes from a cookie but is only honoured if the user is a
 * member; otherwise their first membership is used. Cached per request.
 */
const load = cache(async (): Promise<LoadResult> => {
  if (!isSupabaseConfigured()) return { kind: "unauthenticated" };
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { kind: "unauthenticated" };

  const { data: memberships, error: membershipError } = await supabase
    .from("organisation_memberships")
    .select("organisation_id, role, notify_first_open, notify_viewing_request, notify_contact_request, notify_engagement, notify_email, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (membershipError) throw new Error("Could not load your organisation membership");
  if (!memberships || memberships.length === 0) return { kind: "no_membership", email: user.email ?? null };

  const orgIds = memberships.map((m) => m.organisation_id as string);
  const [{ data: orgs, error: orgError }, { data: profile }] = await Promise.all([
    supabase.from("organisations").select("id, name, slug, media_prefix, timezone, default_currency, is_sample").in("id", orgIds),
    supabase.from("profiles").select("full_name, phone_e164").eq("id", user.id).maybeSingle(),
  ]);
  if (orgError || !orgs) throw new Error("Could not load your organisation");

  const requested = (await cookies()).get(ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organisation_id === requested) ?? memberships[0];
  const org = orgs.find((o) => o.id === membership.organisation_id);
  if (!org) return { kind: "no_membership", email: user.email ?? null };

  return {
    kind: "ok",
    ctx: {
      supabase,
      userId: user.id,
      email: user.email ?? null,
      profile: { fullName: profile?.full_name ?? null, phone: profile?.phone_e164 ?? null },
      organisation: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        mediaPrefix: org.media_prefix,
        timezone: org.timezone,
        defaultCurrency: org.default_currency,
        isSample: org.is_sample,
      },
      role: membership.role as Role,
      preferences: {
        notifyFirstOpen: membership.notify_first_open,
        notifyViewingRequest: membership.notify_viewing_request,
        notifyContactRequest: membership.notify_contact_request,
        notifyEngagement: membership.notify_engagement,
        notifyEmail: membership.notify_email ?? false,
      },
      organisations: memberships.map((m) => ({
        id: m.organisation_id as string,
        name: orgs.find((o) => o.id === m.organisation_id)?.name ?? "Organisation",
        role: m.role as Role,
      })),
    },
  };
});

/** For pages: redirects instead of rendering when the user cannot act. */
export async function requireAuth(): Promise<AuthContext> {
  // Always render per request: never prerender an auth decision at build time.
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  const result = await load();
  if (result.kind === "unauthenticated") redirect("/login");
  if (result.kind === "no_membership") redirect("/no-access");
  return result.ctx;
}

export class ActionAuthError extends Error {}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireActionAuth(roles?: Role[]): Promise<AuthContext> {
  if (!isSupabaseConfigured()) throw new ActionAuthError("The platform is not connected to Supabase yet.");
  const result = await load();
  if (result.kind !== "ok") throw new ActionAuthError("Your session has expired. Please sign in again.");
  if (roles && !roles.includes(result.ctx.role)) throw new ActionAuthError("You do not have permission to do that.");
  return result.ctx;
}

export function displayName(ctx: Pick<AuthContext, "profile" | "email">): string {
  return ctx.profile.fullName || ctx.email?.split("@")[0] || "Agent";
}
