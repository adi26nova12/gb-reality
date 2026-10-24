import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { LinkUnavailable } from "@/components/microsite/link-unavailable";
import { BrochureViewer } from "@/components/microsite/brochure-viewer";
import { getPublicMicrosite } from "@/server/data/microsite-view";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaUrl } from "@/lib/media";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Brochure",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function BrochurePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSupabaseConfigured()) return <LinkUnavailable reason="unavailable" />;
  let site;
  try {
    site = await getPublicMicrosite(token);
  } catch {
    return <LinkUnavailable reason="unavailable" />;
  }
  if (site.status !== "active") return <LinkUnavailable reason={site.status} />;

  const url = site.brochure ? mediaUrl(site.brochure.path) : null;
  if (!site.brochure || !url) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
        <BookOpen className="size-10 text-brass" aria-hidden />
        <h1 className="mt-4 font-display text-3xl font-semibold">The brochure is being prepared</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Your property contact can share it with you directly in the meantime.</p>
        <Link href={`/p/${token}`} className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-emerald-brand hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to your homes
        </Link>
      </main>
    );
  }

  return <BrochureViewer token={token} backHref={`/p/${token}`} url={url} title={site.brochure.title} developmentName={site.development.name} allowDownload={site.brochure.allowDownload} />;
}
