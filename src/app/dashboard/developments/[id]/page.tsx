import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Archive, ArchiveRestore, ExternalLink, MapPin, Pencil, Plus } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { MediaImage } from "@/components/app/media-image";
import { ActionButton } from "@/components/app/action-button";
import { DevelopmentAvailabilityBadge, PropertyAvailabilityBadge, SampleBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { getDevelopment } from "@/server/data/catalogue";
import { setDevelopmentArchived } from "@/server/actions/catalogue";
import { formatArea, formatCompactPrice } from "@/lib/domain/money";
import { formatPhone } from "@/lib/domain/phone";
import { BrochureManager } from "./brochure-manager";

export const metadata: Metadata = { title: "Development" };

export default async function DevelopmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const data = await getDevelopment(ctx, id);
  if (!data) notFound();
  const { development: d, brochures, properties } = data;

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/developments", label: "Developments" }}
        eyebrow={d.developerName ?? undefined}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {d.name}
            {d.isSample && <SampleBadge />}
          </span>
        }
        description={d.location ?? undefined}
        actions={
          <>
            <DevelopmentAvailabilityBadge status={d.availabilityStatus} />
            <Link href={`/dashboard/developments/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden /> Edit
            </Link>
            {d.archivedAt ? (
              <ActionButton variant="outline" action={setDevelopmentArchived.bind(null, id, false)}>
                <ArchiveRestore aria-hidden /> Restore
              </ActionButton>
            ) : (
              <ActionButton
                variant="outline"
                action={setDevelopmentArchived.bind(null, id, true)}
                confirm={{
                  title: `Archive ${d.name}?`,
                  description: "It will no longer be offered for new enquiries. Existing enquiries and microsites are not changed.",
                  confirmLabel: "Archive development",
                  destructive: true,
                }}
              >
                <Archive aria-hidden /> Archive
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <MediaImage path={d.coverImagePath} alt={d.name} className="aspect-[21/9] rounded-xl" priority label="Cover image not uploaded" />
          {d.galleryPaths.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {d.galleryPaths.map((p) => (
                <MediaImage key={p} path={p} alt={`${d.name} gallery`} className="aspect-square rounded-lg" sizes="160px" />
              ))}
            </div>
          )}

          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading
              title={`Properties (${properties.length})`}
              action={
                <Link href={`/dashboard/properties/new?development=${id}`} className={buttonVariants({ size: "sm" })}>
                  <Plus aria-hidden /> Add property
                </Link>
              }
            />
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet. Add units so enquiries can be matched.</p>
            ) : (
              <ul className="divide-y divide-border">
                {properties.map((p) => (
                  <li key={p.id}>
                    <Link href={`/dashboard/properties/${p.id}`} className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-3 text-sm hover:bg-muted/60">
                      <span className="w-20 font-medium">{p.unitReference}</span>
                      <span className="w-16">{p.configuration}</span>
                      <span className="text-muted-foreground">{formatArea(p.area, p.areaUnit)}</span>
                      <span className="ml-auto tabular-nums">{formatCompactPrice(p.price, p.currency)}</span>
                      <PropertyAvailabilityBadge status={p.availabilityStatus} archived={Boolean(p.archivedAt)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Brochure" description="PDF shown in the tracked brochure viewer on microsites." />
            <BrochureManager developmentId={id} brochures={brochures} mediaPrefix={ctx.organisation.mediaPrefix} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="About" />
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{d.description ?? "No description yet."}</p>
            {d.amenities.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {d.amenities.map((a) => (
                  <li key={a} className="rounded-full border border-champagne bg-brass-soft px-2.5 py-0.5 text-xs">
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Location" />
            <p className="flex gap-1.5 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {d.address ?? d.location ?? "No address yet."}
            </p>
            {d.mapUrl && (
              <a href={d.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-brand hover:underline">
                Open map <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Payment plan" />
            {d.paymentPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment plan yet.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {d.paymentPlan.map((m) => (
                  <div key={m.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{m.label}</dt>
                    <dd className="font-medium">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {d.paymentPlanNotes && <p className="mt-3 text-xs text-muted-foreground">{d.paymentPlanNotes}</p>}
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Sales contact" />
            <p className="text-sm">{d.contactName ?? "—"}</p>
            {d.contactPhone && <p className="text-sm text-muted-foreground">{formatPhone(d.contactPhone)}</p>}
            {d.contactEmail && <p className="text-sm text-muted-foreground">{d.contactEmail}</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
