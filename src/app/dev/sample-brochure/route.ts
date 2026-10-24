import { buildSampleBrochurePdf } from "@/lib/sample/catalogue";

export const dynamic = "force-dynamic";

/** Development-only: serves the generated sample brochure PDF. */
export function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(buildSampleBrochurePdf("Example Residences")), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
  });
}
