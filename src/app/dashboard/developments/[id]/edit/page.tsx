import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { getDevelopment } from "@/server/data/catalogue";
import { formatPhone } from "@/lib/domain/phone";
import { DevelopmentForm } from "../../development-form";

export const metadata: Metadata = { title: "Edit development" };

export default async function EditDevelopmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const data = await getDevelopment(ctx, id);
  if (!data) notFound();
  const d = data.development;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: `/dashboard/developments/${id}`, label: d.name }} title="Edit development" />
      <DevelopmentForm
        id={id}
        mediaPrefix={ctx.organisation.mediaPrefix}
        defaults={{
          name: d.name,
          developerName: d.developerName ?? "",
          description: d.description ?? "",
          location: d.location ?? "",
          address: d.address ?? "",
          mapUrl: d.mapUrl ?? "",
          latitude: d.latitude !== null ? String(d.latitude) : "",
          longitude: d.longitude !== null ? String(d.longitude) : "",
          amenities: d.amenities.join("\n"),
          paymentPlan: d.paymentPlan,
          paymentPlanNotes: d.paymentPlanNotes ?? "",
          contactName: d.contactName ?? "",
          contactPhone: formatPhone(d.contactPhone),
          contactEmail: d.contactEmail ?? "",
          availabilityStatus: d.availabilityStatus as never,
          coverImagePath: d.coverImagePath ?? "",
          coverImageMobilePath: d.coverImageMobilePath ?? "",
          galleryPaths: d.galleryPaths,
        }}
      />
    </div>
  );
}
