import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { listAgents } from "@/server/data/leads";
import { getConfigStatus } from "@/lib/env";
import { formatPhone } from "@/lib/domain/phone";
import { timezoneLabel } from "@/lib/domain/dates";
import { NotificationPreferences, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

function Integration({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <li className="flex gap-3">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-brand" aria-label="Configured" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not configured" />}
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const members = await listAgents(ctx);
  const config = getConfigStatus();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Settings" description={`${ctx.organisation.name} · your role: ${ctx.role}`} />

      <section className="rounded-xl border border-border bg-card p-6">
        <SectionHeading title="Your profile" />
        <ProfileForm fullName={ctx.profile.fullName ?? ""} phone={formatPhone(ctx.profile.phone)} />
      </section>

      <section id="notifications" className="scroll-mt-24 rounded-xl border border-border bg-card p-6">
        <SectionHeading title="In-app notifications" description="For enquiries assigned to you (or created by you if unassigned)." />
        <NotificationPreferences initial={ctx.preferences} emailAvailable={config.email} />
        <p className="mt-5 text-xs text-muted-foreground">
          {config.email
            ? "When email is on, the provider's response is recorded for each notification. Accepted by the provider does not guarantee delivery."
            : "Notifications are shown in the app only; email delivery is not configured on this deployment."}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <SectionHeading title="Organisation" />
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd>{ctx.organisation.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Timezone</dt>
            <dd>{timezoneLabel(ctx.organisation.timezone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Currency</dt>
            <dd>{ctx.organisation.defaultCurrency}</dd>
          </div>
        </dl>
        <h3 className="mt-6 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Team ({members.length})</h3>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>
                {m.name}
                {m.id === ctx.userId && <span className="text-muted-foreground"> (you)</span>}
                {m.email && <span className="ml-2 text-xs text-muted-foreground">{m.email}</span>}
              </span>
              <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
        {ctx.role === "owner" || ctx.role === "admin" ? (
          <Link href="/dashboard/settings/team" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
            <UsersRound aria-hidden /> Manage team
          </Link>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Team members are managed by an owner or admin.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <SectionHeading title="Integrations" description="Shown honestly: nothing here is simulated." />
        <ul className="space-y-4">
          <Integration ok={config.supabase} name="Supabase (database, auth, storage)" detail="Connected" />
          <Integration ok={config.tokenSecret} name="Microsite link encryption" detail={config.tokenSecret ? "MICROSITE_TOKEN_SECRET is set" : "Set MICROSITE_TOKEN_SECRET to generate links"} />
          <Integration
            ok
            name="WhatsApp click-to-chat"
            detail="Opens WhatsApp with a pre-filled message. Agents press Send themselves; delivery cannot be confirmed with this method."
          />
          <Integration ok={false} name="WhatsApp Business Platform (automated sending)" detail="Not connected. Requires a Meta business account, approved templates and buyer opt-in." />
          <Integration
            ok={config.invites}
            name="Team invitations"
            detail={config.invites ? "Supabase sends invitation emails" : "Set SUPABASE_SECRET_KEY on the server to invite new people; existing accounts can still be added."}
          />
          <Integration
            ok={config.email}
            name="Email notifications (Resend)"
            detail={config.email ? "Sent to members who opt in, via the Supabase database webhook" : "Not configured. In-app notifications only."}
          />
          <Integration
            ok={config.sharedRateLimit}
            name="Shared rate limiting (Upstash Redis)"
            detail={config.sharedRateLimit ? "Limits apply across all server instances" : "Using per-instance memory limits plus database limits"}
          />
          <Integration ok={false} name="Calendar sync" detail="Not connected. Viewings are managed in Viewing Requests." />
        </ul>
      </section>
    </div>
  );
}
