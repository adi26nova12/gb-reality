import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/auth-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const { next, error } = await searchParams;
  return (
    <AuthShell>
      <div className="eyebrow mb-2 text-brass">Agent access</div>
      <h1 className="font-display text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Use the account your administrator created for you.</p>
      {error === "link" && (
        <p role="alert" className="mb-6 rounded-md border border-[#ecd9b8] bg-brass-soft px-3 py-2 text-sm">
          That link has expired or was already used. Sign in, or request a new password reset link.
        </p>
      )}
      <LoginForm next={next} />
      <Link href="/forgot-password" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        Forgot your password?
      </Link>
    </AuthShell>
  );
}
