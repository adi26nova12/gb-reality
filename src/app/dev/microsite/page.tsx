import type { Metadata } from "next";
import { MicrositeView } from "@/components/microsite/microsite-view";
import { assertDevOnly, sampleMicrosite } from "../sample";

export const metadata: Metadata = { title: "Microsite design preview (sample data)", robots: { index: false } };
export const dynamic = "force-dynamic";

type Search = { name?: string; development?: string; cover?: string; coverMobile?: string };

/** Optional overrides let designers check a real cover image and buyer name: ?name=&development=&cover=&coverMobile= (storage paths). */
export default async function DevMicrositePage({ searchParams }: { searchParams: Promise<Search> }) {
  assertDevOnly();
  const sp = await searchParams;
  const site = sampleMicrosite();
  if (sp.name) site.buyerFirstName = sp.name.slice(0, 24);
  if (sp.development) site.development.name = sp.development.slice(0, 60);
  if (sp.cover) site.development.coverImagePath = sp.cover;
  if (sp.coverMobile) site.development.coverImageMobilePath = sp.coverMobile;
  return <MicrositeView site={site} token={null} preview brochureHref="/dev/brochure" />;
}
