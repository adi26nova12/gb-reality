"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ORG_COOKIE, requireActionAuth } from "@/server/auth";
import { check, fail, ok, toActionError, type ActionResult } from "@/server/action-result";
import { zonedLocalToUtc } from "@/lib/domain/dates";
import { loginSchema, notificationPreferencesSchema, profileSchema, viewingUpdateSchema } from "@/lib/validation/schemas";

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail("Sign-in is unavailable until Supabase is configured.");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Enter your email and password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately generic: do not reveal whether the account exists.
    return fail(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Incorrect email or password.");
  }
  const next = input.next && /^\/dashboard(\/[\w\-/]*)?$/.test(input.next) ? input.next : "/dashboard";
  redirect(next);
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(ORG_COOKIE);
  redirect("/login");
}

export async function switchOrganisation(organisationId: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const id = z.uuid().parse(organisationId);
    if (!ctx.organisations.some((o) => o.id === id)) return fail("You are not a member of that organisation.");
    (await cookies()).set(ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    revalidatePath("/dashboard", "layout");
    return ok(undefined);
  } catch (error) {
    return toActionError(error, "switchOrganisation");
  }
}

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = profileSchema.parse(input);
    check(await ctx.supabase.from("profiles").update({ full_name: v.fullName, phone_e164: v.phone }).eq("id", ctx.userId));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Profile saved");
  } catch (error) {
    return toActionError(error, "updateProfile");
  }
}

export async function updateNotificationPreferences(input: z.input<typeof notificationPreferencesSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = notificationPreferencesSchema.parse(input);
    check(
      await ctx.supabase
        .from("organisation_memberships")
        .update({
          notify_first_open: v.notifyFirstOpen,
          notify_viewing_request: v.notifyViewingRequest,
          notify_contact_request: v.notifyContactRequest,
          notify_engagement: v.notifyEngagement,
          notify_email: v.notifyEmail,
        })
        .eq("organisation_id", ctx.organisation.id)
        .eq("user_id", ctx.userId),
    );
    revalidatePath("/dashboard/settings");
    return ok(undefined, "Notification preferences saved");
  } catch (error) {
    return toActionError(error, "updateNotificationPreferences");
  }
}

export async function markNotificationsRead(ids: string[] | "all"): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    let query = ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", ctx.userId)
      .eq("organisation_id", ctx.organisation.id)
      .is("read_at", null);
    if (ids !== "all") query = query.in("id", z.array(z.uuid()).max(100).parse(ids));
    check(await query);
    revalidatePath("/dashboard", "layout");
    return ok(undefined);
  } catch (error) {
    return toActionError(error, "markNotificationsRead");
  }
}

export async function updateViewingRequest(input: z.input<typeof viewingUpdateSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = viewingUpdateSchema.parse(input);
    let scheduledFor: string | null = null;
    if (v.scheduledFor) {
      const date = zonedLocalToUtc(v.scheduledFor, ctx.organisation.timezone);
      if (Number.isNaN(date.getTime())) return fail("Please correct the highlighted fields.", { scheduledFor: "Choose a valid date and time" });
      scheduledFor = date.toISOString();
    }
    check(
      await ctx.supabase.rpc("update_viewing_request", {
        p_request_id: v.requestId,
        p_status: v.status,
        p_scheduled_for: scheduledFor,
        p_agent_notes: v.agentNotes,
      }),
    );
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Viewing request updated");
  } catch (error) {
    return toActionError(error, "updateViewingRequest");
  }
}
