import "server-only";
import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/env";

/** The public origin for links sent to buyers (NEXT_PUBLIC_SITE_URL wins). */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return getSiteUrl(host ? `${proto}://${host}` : null);
}
