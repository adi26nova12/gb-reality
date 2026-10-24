/**
 * Central place for configuration. Public values (NEXT_PUBLIC_*) are inlined
 * into client bundles; everything else must only be read on the server.
 */

export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New Supabase projects issue a "publishable" key; older ones an "anon" key.
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Accept the project URL with or without a copied "/rest/v1" suffix.
  return { url: url.replace(/\/+$/, "").replace(/\/rest\/v1$/, ""), key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

/** Absolute origin used in links sent to buyers. */
export function getSiteUrl(requestOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  // A localhost setting is only right for this machine: when the app is opened
  // from another device (e.g. a phone on the same network), build buyer links
  // from the address that device actually used.
  const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);
  if (configured && isLocal(configured) && requestOrigin && !isLocal(requestOrigin)) return requestOrigin.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return requestOrigin?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export interface ConfigStatus {
  supabase: boolean;
  tokenSecret: boolean;
  siteUrl: boolean;
  /** Secret key present, so Supabase invitation emails can be sent. */
  invites: boolean;
  /** Notification emails fully configured (provider, sender, webhook secret, secret key). */
  email: boolean;
  /** Shared rate-limit store configured (otherwise per-instance memory). */
  sharedRateLimit: boolean;
}

/** Server-only: never call from a client component. */
export function getConfigStatus(): ConfigStatus {
  return {
    supabase: isSupabaseConfigured(),
    tokenSecret: Boolean(process.env.MICROSITE_TOKEN_SECRET),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    invites: hasSecretKey(),
    email: hasSecretKey() && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.NOTIFICATIONS_WEBHOOK_SECRET),
    sharedRateLimit: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  };
}

function hasSecretKey(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
}
