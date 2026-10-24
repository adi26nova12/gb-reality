import type { Metadata } from "next";
import Link from "next/link";
import { Building2, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { MediaImage } from "@/components/app/media-image";
import { DevelopmentAvailabilityBadge, SampleBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { listDevelopments } from "@/server/data/catalogue";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Developments" };

export default async function DevelopmentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireAuth();
  const archived = (await searchParams).view === "archived";
  const developments = await listDevelopments(ctx, { archived });

  return (
    <>
      <PageHeader
        title="Developments"
        description="Projects in your catalogue. Each microsite is branded with the buyer's chosen development."
        actions={
          <Link href="/dashboard/developments/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden /> Add development
          </Link>
        }
      />
      <div className="mb-6 flex gap-4 border-b border-border text-sm">
        {[
          { label: "Active", href: "/dashboard/developments", on: !archived },
          { label: "Archived", href: "/dashboard/developments?view=archived", on: archived },
        ].map((t) => (
          <Link key={t.label} href={t.href} className={cn("-mb-px border-b-2 px-1 pb-2.5 font-medium", t.on ? "border-emerald-brand" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>
      {developments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={archived ? "No archived developments" : "No developments yet"}
          description={archived ? undefined : "Add your first development with its location, amenities, payment plan and brochure."}
          action={!archived && <Link href="/dashboard/developments/new" className={buttonVariants()}>Add development</Link>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {developments.map((d) => (
            <Link key={d.id} href={`/dashboard/developments/${d.id}`} className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(18,22,20,0.25)]">
              <MediaImage path={d.coverImagePath} alt={d.name} className="aspect-[16/9]" sizes="(max-width: 640px) 100vw, 33vw" label="Cover image" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl leading-tight font-semibold group-hover:text-emerald-brand">{d.name}</h2>
                  {d.isSample && <SampleBadge />}
                </div>
                {d.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden /> {d.location}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <DevelopmentAvailabilityBadge status={d.availabilityStatus} />
                  <span className="text-xs text-muted-foreground">
                    {d.availableCount} of {d.propertyCount} units available
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
