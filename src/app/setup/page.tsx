import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { AuthShell } from "@/components/app/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { getConfigStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  const status = getConfigStatus();
  const items = [
    { ok: status.supabase, label: "Supabase URL and publishable key", env: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", required: true },
    { ok: status.tokenSecret, label: "Microsite link encryption secret", env: "MICROSITE_TOKEN_SECRET", required: true },
    { ok: status.siteUrl, label: "Public site URL for buyer links", env: "NEXT_PUBLIC_SITE_URL", required: false },
  ];

  return (
    <AuthShell>
      <div className="eyebrow mb-2 text-brass">Configuration</div>
      <h1 className="font-display text-3xl font-semibold">Connect the platform</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign-in and all records are stored in Supabase. Until it is configured the dashboard stays locked; there is no demo login.
      </p>
      <ul className="mt-8 space-y-4">
        {items.map((item) => (
          <li key={item.env} className="flex gap-3">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-brand" aria-label="Configured" />
            ) : (
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not configured" />
            )}
            <div>
              <div className="text-sm font-medium">
                {item.label}
                {!item.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span>}
              </div>
              <code className="mt-0.5 block text-xs break-all text-muted-foreground">{item.env}</code>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        Copy <code className="text-foreground">.env.example</code> to <code className="text-foreground">.env.local</code>, fill in the values,
        apply the migration in <code className="text-foreground">supabase/migrations</code>, then restart the server. The README has step-by-step
        instructions.
      </div>
      {status.supabase && (
        <Link href="/login" className={buttonVariants({ className: "mt-6 w-full", size: "lg" })}>
          Continue to sign in
        </Link>
      )}
    </AuthShell>
  );
}
