"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAuth } from "@/server/auth";
import { check, fail, ok, toActionError, type ActionResult } from "@/server/action-result";
import { getAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/server/url";

const MANAGERS = ["owner", "admin"] as const;
const roleSchema = z.enum(["owner", "admin", "agent"]);
const memberSchema = z.object({
  email: z.email("Enter a valid email address").transform((e) => e.trim().toLowerCase()),
  role: roleSchema,
  fullName: z.string().trim().max(120).optional(),
});

const TEAM_ERRORS: Record<string, string> = {
  forbidden: "Only owners and admins can manage the team.",
  only_owners_manage_owners: "Only an owner can add, change or remove an owner.",
  last_owner: "The organisation needs at least one owner. Make someone else an owner first.",
  user_not_found: "No account uses that email yet. Send them an invitation instead.",
  already_member: "That person is already a member of this organisation.",
  member_not_found: "That person is not a member of this organisation.",
  invalid_role: "That role is not recognised.",
};

function teamError(error: unknown, context: string): ActionResult<never> {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const known = Object.keys(TEAM_ERRORS).find((k) => message.includes(k));
  if (known) return fail(TEAM_ERRORS[known]);
  return toActionError(error, context);
}

/** Adds someone who already has an account in this Supabase project. */
export async function addMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth([...MANAGERS]);
    const parsed = memberSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    check(await ctx.supabase.rpc("add_organisation_member", { p_org: ctx.organisation.id, p_email: parsed.data.email, p_role: parsed.data.role }));
    revalidatePath("/dashboard/settings", "layout");
    return ok(undefined, `${parsed.data.email} added to the team`);
  } catch (error) {
    return teamError(error, "addMember");
  }
}

/**
 * Creates the account and asks Supabase to email an invitation, then adds the
 * membership. "Sent" here means Supabase accepted the request; it does not
 * mean the email was delivered.
 */
export async function inviteMember(input: z.input<typeof memberSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth([...MANAGERS]);
    const parsed = memberSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    const v = parsed.data;
    if (v.role === "owner" && ctx.role !== "owner") return fail(TEAM_ERRORS.only_owners_manage_owners);

    const admin = getAdminClient();
    if (!admin) return fail("Invitations need SUPABASE_SECRET_KEY on the server. You can still add people who already have an account.");

    const { error } = await admin.auth.admin.inviteUserByEmail(v.email, {
      data: v.fullName ? { full_name: v.fullName } : undefined,
      redirectTo: `${await siteUrl()}/auth/confirm?next=/account/set-password`,
    });
    if (error) {
      const exists = error.status === 422 || /already/i.test(error.message);
      if (!exists) {
        console.error("[inviteMember] invite failed", { status: error.status });
        return fail("Supabase could not send the invitation. Check the project's email settings and try again.");
      }
      // The account exists already: just add the membership.
    }

    // Runs as the signed-in admin, so the membership rules in SQL still apply.
    check(await ctx.supabase.rpc("add_organisation_member", { p_org: ctx.organisation.id, p_email: v.email, p_role: v.role }));
    revalidatePath("/dashboard/settings", "layout");
    return ok(
      undefined,
      error ? `${v.email} already had an account and was added to the team` : `Invitation requested for ${v.email}. Supabase will email them a link to set their password.`,
    );
  } catch (error) {
    return teamError(error, "inviteMember");
  }
}

export async function setMemberRole(userId: string, role: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth([...MANAGERS]);
    const v = z.object({ userId: z.uuid(), role: roleSchema }).parse({ userId, role });
    check(await ctx.supabase.rpc("set_organisation_member_role", { p_org: ctx.organisation.id, p_user: v.userId, p_role: v.role }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Role updated");
  } catch (error) {
    return teamError(error, "setMemberRole");
  }
}

export async function removeMember(userId: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth([...MANAGERS]);
    const id = z.uuid().parse(userId);
    check(await ctx.supabase.rpc("remove_organisation_member", { p_org: ctx.organisation.id, p_user: id }));
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Removed from the team. Their enquiries are now unassigned.");
  } catch (error) {
    return teamError(error, "removeMember");
  }
}
