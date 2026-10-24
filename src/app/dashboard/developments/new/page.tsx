import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { DevelopmentForm } from "../development-form";

export const metadata: Metadata = { title: "New development" };

export default async function NewDevelopmentPage() {
  const ctx = await requireAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: "/dashboard/developments", label: "Developments" }} title="New development" />
      <DevelopmentForm mediaPrefix={ctx.organisation.mediaPrefix} />
    </div>
  );
}
