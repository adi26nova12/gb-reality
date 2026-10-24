import type { Metadata } from "next";
import { MicrositeView } from "@/components/microsite/microsite-view";
import { LinkUnavailable } from "@/components/microsite/link-unavailable";
import { getPublicMicrosite } from "@/server/data/microsite-view";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Deliberately generic: link previews in chat apps must not reveal names or prices.
export const metadata: Metadata = {
  title: "Your personalised property selection",
  description: "A private selection of homes prepared for you.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PublicMicrositePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSupabaseConfigured()) return <LinkUnavailable reason="unavailable" />;

  let site;
  try {
    site = await getPublicMicrosite(token);
  } catch {
    return <LinkUnavailable reason="unavailable" />;
  }
  if (site.status !== "active") return <LinkUnavailable reason={site.status} />;
  return <MicrositeView site={site} token={token} />;
}
