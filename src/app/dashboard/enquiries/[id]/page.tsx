import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertTriangle, Archive, ArchiveRestore, CalendarClock, Globe, Pencil, Sparkles } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { LeadStatusBadge, SampleBadge, ViewingStatusBadge } from "@/components/app/status-badges";
import { Timeline } from "@/components/app/timeline";
import { ActionButton } from "@/components/app/action-button";
import { EmptyState } from "@/components/app/empty-state";
import { ViewingManager } from "@/components/app/viewing-manager";
import { buttonVariants } from "@/components/ui/button";
import { displayName, requireAuth } from "@/server/auth";
import { getLeadDetail } from "@/server/data/leads";
import { siteUrl } from "@/server/url";
import { setLeadArchived } from "@/server/actions/leads";
import { formatBudgetRange, formatCompactPrice } from "@/lib/domain/money";
import { formatCalendarDate, formatDateTime } from "@/lib/domain/dates";
import { formatPhone } from "@/lib/domain/phone";
import {
  CONTACT_PREFERENCE_LABELS,
  PROPERTY_TYPE_LABELS,
  PURCHASE_TIMEFRAME_LABELS,
  TIME_RANGE_LABELS,
  type ContactPreference,
  type PropertyType,
  type PurchaseTimeframe,
  type TimeRange,
} from "@/lib/domain/constants";
import { MicrositeShare } from "./microsite-share";
import { StatusControl } from "./status-control";

export const metadata: Metadata = { title: "Enquiry" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default async function EnquiryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ shared?: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const detail = await getLeadDetail(ctx, id, await siteUrl());
  if (!detail) notFound();
  const { data: cover } = await ctx.supabase
    .from("developments")
    .select("cover_image_path, cover_image_mobile_path")
    .eq("id", detail.lead.developmentId)
    .maybeSingle();
  const { lead, microsite, selectedProperties, timeline, viewings } = detail;
  const tz = ctx.organisation.timezone;
  const highlight = (await searchParams).shared === "new";

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/enquiries", label: "Enquiries" }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {lead.buyerName}
            {lead.isSample && <SampleBadge />}
          </span>
        }
        description={`${lead.configuration} · ${lead.developmentName} · Enquiry created ${formatDateTime(lead.createdAt, tz)}`}
        actions={
          <>
            <LeadStatusBadge status={lead.status} />
            <Link href={`/dashboard/enquiries/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden /> Edit
            </Link>
            {lead.archivedAt ? (
              <ActionButton variant="outline" action={setLeadArchived.bind(null, id, false)}>
                <ArchiveRestore aria-hidden /> Restore
              </ActionButton>
            ) : (
              <ActionButton
                variant="outline"
                action={setLeadArchived.bind(null, id, true)}
                confirm={{
                  title: `Archive ${lead.buyerName}'s enquiry?`,
                  description: "It will be hidden from the active list and its microsite link will stop showing property content. You can restore it later.",
                  confirmLabel: "Archive enquiry",
                  destructive: true,
                }}
              >
                <Archive aria-hidden /> Archive
              </ActionButton>
            )}
          </>
        }
      />

      {lead.archivedAt && (
        <div role="status" className="mb-6 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Archived {formatDateTime(lead.archivedAt, tz)}. The microsite link shows an expired-link page while archived.
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          {microsite ? (
            <MicrositeShare
              leadId={id}
              microsite={microsite}
              buyerName={lead.buyerName}
              buyerPhone={lead.phone}
              developmentName={lead.developmentName}
              configuration={lead.configuration}
              agentName={lead.assignedAgentName ?? displayName(ctx)}
              contactedAt={lead.contactedAt}
              timezone={tz}
              highlight={highlight}
              hasCoverImage={Boolean(cover?.cover_image_path || cover?.cover_image_mobile_path)}
            />
          ) : (
            <EmptyState
              icon={Globe}
              title="No active microsite"
              description={
                detail.micrositeHistory.length
                  ? "The previous link was revoked. Review matching properties to issue a new one."
                  : "Review the matching properties, then generate a secure personalised link for this buyer."
              }
              action={
                !lead.archivedAt && (
                  <Link href={`/dashboard/enquiries/${id}/microsite`} className={buttonVariants({ size: "lg" })}>
                    <Sparkles aria-hidden /> Match properties &amp; generate microsite
                  </Link>
                )
              }
            />
          )}

          {microsite && (
            <section className="rounded-xl border border-border bg-card p-6">
              <SectionHeading title={`Properties on the microsite (${selectedProperties.length})`} description="Live catalogue data. Prices and availability update automatically." />
              <ul className="divide-y divide-border">
                {selectedProperties.map((p) => {
                  const unavailable = p.archived || p.availabilityStatus !== "available";
                  const priceChanged = p.snapshotPrice !== null && p.price !== null && Number(p.snapshotPrice) !== p.price;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                      <Link href={`/dashboard/properties/${p.id}`} className="font-medium hover:underline">
                        {p.configuration} · {p.unitReference}
                      </Link>
                      <span className="text-muted-foreground">{p.developmentName}</span>
                      <span className="ml-auto tabular-nums">{formatCompactPrice(p.price, p.currency)}</span>
                      {unavailable && (
                        <span className="inline-flex w-full items-center gap-1 text-xs text-[#8a4b12]">
                          <AlertTriangle className="size-3.5" aria-hidden /> Now {p.archived ? "archived" : p.availabilityStatus}; buyers see it as unavailable with no price.
                        </span>
                      )}
                      {priceChanged && !unavailable && (
                        <span className="w-full text-xs text-muted-foreground">Price changed since shared (was {formatCompactPrice(Number(p.snapshotPrice), p.currency)}).</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Engagement timeline" description="Recorded events only. A page view means the page was displayed, nothing more." />
            <Timeline events={timeline} timezone={tz} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Status" />
            <StatusControl key={lead.status} leadId={id} status={lead.status} />
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Viewing requests" />
            {viewings.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet. Buyers can request a viewing from their microsite.</p>
            ) : (
              <ul className="space-y-4">
                {viewings.map((v) => (
                  <li key={v.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <ViewingStatusBadge status={v.status} />
                      <ViewingManager request={v} timezone={tz} />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-sm">
                      <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
                      {v.scheduledFor ? formatDateTime(v.scheduledFor, tz) : `${formatCalendarDate(v.preferredDate)} · ${TIME_RANGE_LABELS[v.preferredTimeRange as TimeRange]?.split(" (")[0] ?? v.preferredTimeRange}`}
                    </div>
                    {v.propertyLabel && <div className="mt-0.5 text-xs text-muted-foreground">{v.propertyLabel}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Buyer details" />
            <dl className="divide-y divide-border">
              <Detail label="Mobile">
                <a href={`tel:${lead.phone}`} className="tabular-nums hover:underline">
                  {formatPhone(lead.phone)}
                </a>
              </Detail>
              <Detail label="Email">{lead.email}</Detail>
              <Detail label="Prefers">{CONTACT_PREFERENCE_LABELS[lead.contactPreference as ContactPreference]}</Detail>
              <Detail label="Development">{lead.developmentName}</Detail>
              <Detail label="Configuration">{lead.configuration}</Detail>
              <Detail label="Budget">{formatBudgetRange(lead.budgetMin, lead.budgetMax, lead.budgetCurrency)}</Detail>
              <Detail label="Type">{lead.propertyType ? PROPERTY_TYPE_LABELS[lead.propertyType as PropertyType] : null}</Detail>
              <Detail label="Bedrooms">{lead.bedrooms}</Detail>
              <Detail label="Location">{lead.preferredLocation}</Detail>
              <Detail label="Floor">{lead.preferredFloor}</Detail>
              <Detail label="Timeframe">{lead.purchaseTimeframe ? PURCHASE_TIMEFRAME_LABELS[lead.purchaseTimeframe as PurchaseTimeframe] : null}</Detail>
              <Detail label="Agent">{lead.assignedAgentName ?? "Unassigned"}</Detail>
            </dl>
            {lead.notes && (
              <div className="mt-4 rounded-lg bg-muted/60 p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Private notes</div>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
