import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Privileged client that bypasses Row Level Security. Optional: used only for
 * (a) sending Supabase invitation emails to new team members and (b) the
 * notification email webhook. Every caller must authorise the request itself
 * before using it. Never import this from a client component.
 */
export function getAdminClient() {
  const env = getSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !secret) return null;
  return createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
