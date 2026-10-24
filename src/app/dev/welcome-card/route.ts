import { type NextRequest } from "next/server";
import { renderWelcomeCard } from "@/server/welcome-card";
import { mediaUrl } from "@/lib/media";

/** Development-only: preview the personalised welcome card. ?name=&development=&cover=&format=portrait|landscape */
export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const q = request.nextUrl.searchParams;
  return renderWelcomeCard({
    firstName: q.get("name"),
    developmentName: q.get("development") ?? "Example Residences",
    location: q.get("location"),
    imageUrl: mediaUrl(q.get("cover")),
    format: q.get("format") === "landscape" ? "landscape" : "portrait",
  });
}
