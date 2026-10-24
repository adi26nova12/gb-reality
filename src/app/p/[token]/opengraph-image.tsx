import { getPublicMicrosite } from "@/server/data/microsite-view";
import { CARD_SIZES, renderWelcomeCard } from "@/server/welcome-card";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaUrl } from "@/lib/media";

// Link preview shown when the agent sends the microsite on WhatsApp. It shows
// the buyer's first name and the development only: no prices, phone numbers
// or other details. Revoked or expired links get a neutral card.
export const alt = "Your personalised property selection";
export const size = CARD_SIZES.landscape;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = isSupabaseConfigured() ? await getPublicMicrosite(token).catch(() => null) : null;
  const headers = { "Cache-Control": "private, no-store" };

  if (!site || site.status !== "active") {
    return renderWelcomeCard({ firstName: null, developmentName: "your new home", imageUrl: null, format: "landscape" }, headers);
  }
  const d = site.development;
  return renderWelcomeCard(
    { firstName: site.buyerFirstName, developmentName: d.name, location: d.location, imageUrl: mediaUrl(d.coverImagePath ?? d.coverImageMobilePath), format: "landscape" },
    headers,
  );
}
