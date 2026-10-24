import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck, CalendarClock, Eye, Globe, Inbox, Sparkles, Trophy, UserPlus } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { RangeTabs } from "@/components/app/range-tabs";
import { Funnel } from "@/components/app/funnel";
import { EmptyState } from "@/components/app/empty-state";
import { LeadStatusBadge, MicrositeStateBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { displayName, requireAuth } from "@/server/auth";
import { getOverview, getRecentActivity } from "@/server/data/insights";
import { LEAD_STATUSES, LEAD_STATUS_META } from "@/lib/domain/lead-status";
import { formatDateTime, parseRange, rangeBounds, relativeTime, timezoneLabel, RANGE_OPTIONS } from "@/lib/domain/dates";
import type { MicrositeState } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireAuth();
  const range = parseRange((await searchParams).range);
  const { from, to } = rangeBounds(range);
  const tz = ctx.organisation.timezone;

  const [{ count: developmentCount }, overview, activity] = await Promise.all([
    ctx.supabase.from("developments").select("id", { count: "exact", head: true }).eq("organisation_id", ctx.organisation.id).is("archived_at", null),
    getOverview(ctx, from, to),
    getRecentActivity(ctx),
  ]);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase() ?? "";
  const m = overview.metrics;
  const totalLeads = Object.values(overview.statusCounts).reduce((a, b) => a + b, 0);

  if (!developmentCount && totalLeads === 0) {
    return (
      <>
        <PageHeader eyebrow={ctx.organisation.name} title={`Welcome, ${displayName(ctx).split(" ")[0]}`} description="Set up your catalogue once, then every enquiry gets its own microsite in a few clicks." />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: "1", title: "Add a development", text: "Name, location, amenities, payment plan and brochure.", href: "/dashboard/developments/new", cta: "Add development" },
            { n: "2", title: "Add its properties", text: "Units with configuration, price, availability and floor plans.", href: "/dashboard/properties/new", cta: "Add property" },
            { n: "3", title: "Create an enquiry", text: "Match homes, generate a microsite and send it on WhatsApp.", href: "/dashboard/enquiries/new", cta: "New enquiry" },
          ].map((s) => (
            <div key={s.n} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <span className="font-display text-3xl text-brass">{s.n}</span>
              <h2 className="mt-3 text-sm font-semibold">{s.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.text}</p>
              <Link href={s.href} className={buttonVariants({ variant: s.n === "1" ? "default" : "outline", className: "mt-5 self-start" })}>
                {s.cta} <ArrowRight aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={ctx.organisation.name}
        title="Overview"
        description={`Figures for the ${rangeLabel} unless stated. Times shown in ${timezoneLabel(tz)}.`}
        actions={<RangeTabs value={range} basePath="/dashboard" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Total enquiries" value={m.totalEnquiries} hint="Created in this period" icon={Inbox} />
        <StatCard label="New enquiries" value={m.newEnquiries} hint="Awaiting a microsite (all time)" icon={UserPlus} />
        <StatCard label="Microsites generated" value={m.micrositesGenerated} icon={Globe} />
        <StatCard label="Microsite visits" value={m.visits} hint="Browser sessions, refreshes not counted" icon={Eye} />
        <StatCard label="Viewing requests" value={m.viewingRequests} hint="Submitted by buyers" icon={CalendarClock} />
        <StatCard label="Viewings scheduled" value={m.viewingsScheduled} hint="Confirmed and upcoming" icon={CalendarCheck} />
        <StatCard label="Converted" value={m.converted} hint="Marked converted in this period" icon={Trophy} />
        <div className="flex flex-col justify-between rounded-xl border border-dashed border-champagne bg-brass-soft/60 p-5">
          <Sparkles className="size-4 text-brass" aria-hidden />
          <div>
            <p className="text-sm font-medium">New enquiry just came in?</p>
            <Link href="/dashboard/enquiries/new" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-emerald-brand hover:underline">
              Create it and generate a microsite <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <SectionHeading
            title="Recent enquiries"
            action={<Link href="/dashboard/enquiries" className="text-xs font-medium text-emerald-brand hover:underline">View all</Link>}
          />
          {activity.recentLeads.length === 0 ? (
            <EmptyState compact icon={Inbox} title="No enquiries yet" description="Enquiries you create appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {activity.recentLeads.map((l) => (
                <li key={l.id}>
                  <Link href={`/dashboard/enquiries/${l.id}`} className="-mx-2 flex items-center gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.buyerName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {l.configuration} · {l.developmentName}
                      </div>
                    </div>
                    <LeadStatusBadge status={l.status} />
                    <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{relativeTime(l.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <SectionHeading title="Latest buyer activity" description="Recorded microsite events" />
          {activity.latestActivity.length === 0 ? (
            <EmptyState compact icon={Eye} title="No buyer activity yet" description="When a buyer opens their microsite, it shows up here." />
          ) : (
            <ul className="space-y-3.5">
              {activity.latestActivity.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-brand" aria-hidden />
                  <div className="min-w-0">
                    <Link href={`/dashboard/enquiries/${e.leadId}`} className="font-medium hover:underline">
                      {e.buyerName}
                    </Link>
                    <span className="text-muted-foreground"> — {e.description}</span>
                    <div className="text-xs text-muted-foreground">{formatDateTime(e.occurredAt, tz)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-6">
          <SectionHeading title="Enquiry status" description="All active enquiries" />
          {totalLeads === 0 ? (
            <p className="text-sm text-muted-foreground">No enquiries yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {LEAD_STATUSES.map((s) => (
                <li key={s}>
                  <Link href={`/dashboard/enquiries?status=${s}`} className="group flex items-center gap-3 text-xs">
                    <span className="w-32 shrink-0 text-muted-foreground group-hover:text-foreground">{LEAD_STATUS_META[s].label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-charcoal/80" style={{ width: `${(overview.statusCounts[s] / totalLeads) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right font-medium tabular-nums">{overview.statusCounts[s]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <SectionHeading title="Enquiry to viewing" description={`Enquiries created in the ${rangeLabel}`} />
          {overview.funnel.enquiries === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet. Conversion appears once enquiries exist in this period.</p>
          ) : (
            <Funnel
              steps={[
                { label: "Enquiries", value: overview.funnel.enquiries },
                { label: "Microsite generated", value: overview.funnel.withMicrosite },
                { label: "Microsite opened", value: overview.funnel.opened },
                { label: "Viewing requested", value: overview.funnel.viewingRequested },
                { label: "Viewing scheduled", value: overview.funnel.viewingScheduled },
                { label: "Converted", value: overview.funnel.converted },
              ]}
              note={overview.funnel.enquiries < 10 ? "Small sample: percentages will move a lot with each enquiry." : undefined}
            />
          )}
        </section>

        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading
              title="Upcoming viewings"
              action={<Link href="/dashboard/viewings?view=upcoming" className="text-xs font-medium text-emerald-brand hover:underline">All</Link>}
            />
            {activity.upcomingViewings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed viewings scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {activity.upcomingViewings.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/dashboard/enquiries/${v.leadId}`} className="truncate font-medium hover:underline">
                      {v.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(v.scheduledFor, tz)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading
              title="Recent microsites"
              action={<Link href="/dashboard/microsites" className="text-xs font-medium text-emerald-brand hover:underline">All</Link>}
            />
            {activity.recentMicrosites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No microsites generated yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.recentMicrosites.map((ms) => (
                  <li key={ms.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/dashboard/enquiries/${ms.leadId}`} className="truncate font-medium hover:underline">
                      {ms.buyerName}
                    </Link>
                    <MicrositeStateBadge state={ms.state as MicrositeState} opened={ms.opened} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {!developmentCount && (
        <div className="mt-8">
          <EmptyState compact icon={Building2} title="No active developments" description="Add a development so new enquiries can be matched." action={<Link href="/dashboard/developments/new" className={buttonVariants()}>Add development</Link>} />
        </div>
      )}
    </>
  );
}
