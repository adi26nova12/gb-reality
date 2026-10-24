import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarClock, ChartNoAxesColumn, Eye, LayoutPanelTop, MousePointerClick } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { RangeTabs } from "@/components/app/range-tabs";
import { Funnel } from "@/components/app/funnel";
import { EmptyState } from "@/components/app/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/server/auth";
import { getAnalytics } from "@/server/data/insights";
import { parseRange, rangeBounds, relativeTime, RANGE_OPTIONS } from "@/lib/domain/dates";
import { ByDevelopment, EngagementOverTime } from "./engagement-chart";

export const metadata: Metadata = { title: "Engagement analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireAuth();
  const range = parseRange((await searchParams).range);
  const { from, to } = rangeBounds(range);
  const a = await getAnalytics(ctx, from, to);
  const t = a.totals;
  const label = RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase();

  return (
    <>
      <PageHeader
        title="Engagement analytics"
        description={`Recorded buyer activity on microsites for the ${label}. Agent previews are never counted.`}
        actions={<RangeTabs value={range} basePath="/dashboard/analytics" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Microsite visits" value={t.visits} hint="Distinct browser sessions" icon={Eye} />
        <StatCard label="Unique microsites opened" value={t.micrositesOpened} hint="Links opened at least once" icon={ChartNoAxesColumn} />
        <StatCard label="Property detail views" value={t.propertyDetails} hint={`${t.floorPlans} floor plan opens`} icon={LayoutPanelTop} />
        <StatCard label="Brochure engagement" value={t.brochureOpens} hint={`${t.brochurePages} brochure pages displayed`} icon={BookOpen} />
        <StatCard label="Viewing requests" value={t.viewingRequests} icon={CalendarClock} />
        <StatCard label="Payment plan opens" value={t.paymentPlanViews} icon={MousePointerClick} />
        <StatCard label="WhatsApp taps" value={t.whatsappClicks} hint="Contact button on microsites" icon={MousePointerClick} />
        <StatCard label="Raw events" value={t.rawEvents} hint="After refresh deduplication" icon={ChartNoAxesColumn} />
      </div>

      {t.rawEvents === 0 ? (
        <div className="mt-8">
          <EmptyState icon={Eye} title="No buyer activity in this period" description="Activity appears once buyers open the microsites you share. Try a longer date range." />
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Engagement over time" description="Days in your organisation's timezone" />
            <EngagementOverTime data={a.daily} />
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-6">
              <SectionHeading title="By development" />
              <ByDevelopment data={a.byDevelopment} />
            </section>
            <section className="rounded-xl border border-border bg-card p-6">
              <SectionHeading title="Enquiry to viewing" description={`Enquiries created in the ${label}`} />
              {a.funnel.enquiries === 0 ? (
                <p className="text-sm text-muted-foreground">No enquiries were created in this period.</p>
              ) : (
                <Funnel
                  steps={[
                    { label: "Enquiries", value: a.funnel.enquiries },
                    { label: "Microsite generated", value: a.funnel.withMicrosite },
                    { label: "Microsite opened", value: a.funnel.opened },
                    { label: "Viewing requested", value: a.funnel.viewingRequested },
                    { label: "Viewing scheduled", value: a.funnel.viewingScheduled },
                    { label: "Converted", value: a.funnel.converted },
                  ]}
                  note={a.funnel.enquiries < 10 ? "Small sample: treat percentages as indicative." : undefined}
                />
              )}
            </section>
          </div>

          <section className="mt-8 rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Most active microsites" description="Neutral activity counts. Activity alone does not indicate purchase intent." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Buyer</TableHead>
                    <TableHead>Development</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead>Latest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.byMicrosite.map((m) => (
                    <TableRow key={m.micrositeId} className="text-sm">
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/enquiries/${m.leadId}`} className="hover:underline">
                          {m.buyerName}
                        </Link>
                      </TableCell>
                      <TableCell>{m.developmentName}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.visits}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.events}</TableCell>
                      <TableCell className="text-muted-foreground">Recently engaged · {relativeTime(m.lastActivityAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}

      <section className="mt-8 rounded-xl border border-dashed border-border p-6 text-xs leading-relaxed text-muted-foreground">
        <h2 className="mb-2 text-sm font-semibold text-foreground">How these numbers are counted</h2>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Visit</strong>: a browser session that opened a microsite. Sessions are identified by a random ID kept in the tab&apos;s session storage, with no cookies or
            fingerprinting. One person on two devices counts as two visits.
          </li>
          <li>Repeat events from the same session within 30 minutes (2 minutes for clicks) are ignored, so refreshing does not inflate counts.</li>
          <li>A &ldquo;brochure page displayed&rdquo; means the viewer showed that page for about a second; it does not mean it was read.</li>
          <li>Link previews generated by WhatsApp are not counted because events are only sent by the buyer&apos;s browser.</li>
        </ul>
      </section>
    </>
  );
}
