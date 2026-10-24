import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { developmentOptions } from "@/server/data/catalogue";
import { PropertyForm } from "../property-form";

export const metadata: Metadata = { title: "New property" };

export default async function NewPropertyPage({ searchParams }: { searchParams: Promise<{ development?: string }> }) {
  const ctx = await requireAuth();
  const developments = await developmentOptions(ctx);
  const preselect = (await searchParams).development;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: "/dashboard/properties", label: "Properties" }} title="New property" />
      {developments.length === 0 ? (
        <EmptyState icon={Building2} title="Add a development first" description="Every property belongs to a development." action={<Link href="/dashboard/developments/new" className={buttonVariants()}>Add development</Link>} />
      ) : (
        <PropertyForm
          developments={developments}
          mediaPrefix={ctx.organisation.mediaPrefix}
          defaultCurrency={ctx.organisation.defaultCurrency}
          defaults={preselect && developments.some((d) => d.id === preselect) ? { developmentId: preselect } : undefined}
        />
      )}
    </div>
  );
}
