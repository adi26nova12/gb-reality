import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { MicrositeView } from "@/components/microsite/microsite-view";
import { requireAuth } from "@/server/auth";
import { getMicrositePreview } from "@/server/data/microsite-view";

export const metadata: Metadata = { title: "Microsite preview" };

export default async function MicrositePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const preview = await getMicrositePreview(ctx, id);
  if (!preview) notFound();

  return (
    <div className="-mx-4 -my-8 sm:-mx-8 sm:-my-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-8">
        <Link href={`/dashboard/enquiries/${preview.leadId}`} className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to {preview.buyerName}
        </Link>
        <span className="text-xs text-muted-foreground">
          {preview.state === "active" ? "This is what the buyer sees today." : `This link is ${preview.state}; the buyer currently sees an expired-link page.`}
        </span>
      </div>
      <div className="mx-auto max-w-[1200px] overflow-hidden border-x border-border">
        <MicrositeView site={preview.site} token={null} preview />
      </div>
    </div>
  );
}
