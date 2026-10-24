import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/auth-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  return (
    <AuthShell>
      <div className="eyebrow mb-2 text-brass">Account</div>
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">We&apos;ll email a link to set a new password.</p>
      <ForgotPasswordForm />
      <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
