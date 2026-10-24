import { type NextRequest } from "next/server";
import { z } from "zod";
import { ActionAuthError, requireActionAuth } from "@/server/auth";
import { fileSlug, renderWelcomeCard, type CardFormat } from "@/server/welcome-card";
import { firstName } from "@/lib/domain/whatsapp";
import { mediaUrl } from "@/lib/media";

/**
 * The buyer's personalised welcome image, for the agent to download and send
 * on WhatsApp as a photo alongside the link. Signed-in members only.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  let ctx;
  try {
    ctx = await requireActionAuth();
  } catch (error) {
    return new Response(error instanceof ActionAuthError ? error.message : "Unauthorised", { status: 401 });
  }

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("buyer_name, development_id")
    .eq("organisation_id", ctx.organisation.id)
    .eq("id", id)
    .maybeSingle();
  if (!lead) return new Response("Not found", { status: 404 });

  const { data: dev } = await ctx.supabase
    .from("developments")
    .select("name, location, cover_image_path, cover_image_mobile_path")
    .eq("id", lead.development_id)
    .maybeSingle();
  if (!dev) return new Response("Not found", { status: 404 });

  const format: CardFormat = request.nextUrl.searchParams.get("format") === "landscape" ? "landscape" : "portrait";
  const image = format === "portrait" ? dev.cover_image_mobile_path ?? dev.cover_image_path : dev.cover_image_path ?? dev.cover_image_mobile_path;
  const name = firstName(lead.buyer_name);
  const download = request.nextUrl.searchParams.get("download") === "1";

  return renderWelcomeCard(
    { firstName: name, developmentName: dev.name, location: dev.location, imageUrl: mediaUrl(image), format },
    {
      "Cache-Control": "private, max-age=300",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileSlug(dev.name, name, format)}.png"` } : {}),
    },
  );
}
