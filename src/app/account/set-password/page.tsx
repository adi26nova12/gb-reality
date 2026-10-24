import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  return (
    <AuthShell>
      <div className="eyebrow mb-2 text-brass">Account</div>
      <h1 className="font-display text-3xl font-semibold">Set your password</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">For {user.email}. Use at least 12 characters.</p>
      <SetPasswordForm />
    </AuthShell>
  );
}
