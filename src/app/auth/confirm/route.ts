import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "signup", "magiclink", "email_change"];
const SAFE_NEXT = /^\/(dashboard(\/[\w\-/]*)?|account\/set-password)$/;

/**
 * Landing point for links in Supabase emails (invitations, password resets).
 * Accepts the token-hash style link recommended for server-rendered apps, and
 * the PKCE `?code=` style as a fallback.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = SAFE_NEXT.test(nextParam) ? nextParam : "/dashboard";
  const failure = new URL("/login?error=link", request.url);
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/setup", request.url));

  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(failure);
    const destination = type === "invite" || type === "recovery" ? "/account/set-password" : next;
    return NextResponse.redirect(new URL(destination, request.url));
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(failure);
}
