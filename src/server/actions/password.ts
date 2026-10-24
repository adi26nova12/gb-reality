"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { siteUrl } from "@/server/url";
import { fail, ok, type ActionResult } from "@/server/action-result";

const passwordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match" });

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail("Password reset is unavailable until Supabase is configured.");
  const parsed = z.email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return fail("Enter a valid email address.");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/account/set-password`,
  });
  if (error?.status === 429) return fail("Too many requests. Please wait a few minutes and try again.");
  // Same answer whether or not the account exists, so this cannot be used to discover accounts.
  return ok(undefined, "If an account uses that email, Supabase will send it a reset link.");
}

export async function setPassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail("Supabase is not configured.");
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { [String(issue.path[0] ?? "password")]: issue.message });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("This link has expired. Request a new one from the sign-in page.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail(/same|different/i.test(error.message) ? "Choose a password you have not used before." : "Your password could not be saved. Please try again.");
  }
  redirect("/dashboard");
}
