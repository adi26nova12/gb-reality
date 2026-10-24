import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isWellFormedToken } from "@/lib/security/tokens";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { fieldErrors, viewingRequestSchema } from "@/lib/validation/schemas";

const FIELD_MESSAGES: Record<string, string> = {
  name: "Please enter your name.",
  phone: "Please enter a valid mobile number with country code.",
  preferredDate: "Please choose a date between today and one year from now.",
  timeRange: "Please choose a time of day.",
  property: "That home is no longer available. Please choose another or leave it open.",
  message: "Your message is too long.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isWellFormedToken(token)) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (!isSupabaseConfigured()) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const limit = await rateLimit(`viewing:${clientKey(request.headers)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ status: "rate_limited", error: "Too many requests. Please try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const text = await request.text();
  if (text.length > 4096) return NextResponse.json({ status: "invalid" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }
  const parsed = viewingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid", fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
  }
  const v = parsed.data;

  const { data, error } = await createPublicClient().rpc("submit_viewing_request", {
    p_token: token,
    p_session_id: v.sessionId,
    p_name: v.name,
    p_phone_e164: v.phone,
    p_preferred_date: v.preferredDate,
    p_time_range: v.timeRange,
    p_property_ref: v.propertyRef,
    p_message: v.message,
  });
  if (error) {
    console.error("[viewing-request] rpc failed", { code: error.code });
    return NextResponse.json({ status: "error", error: "We could not save your request. Please try again." }, { status: 500 });
  }

  const result = data as { status: string; field?: string };
  switch (result.status) {
    case "submitted":
      return NextResponse.json({ status: "submitted" }, { status: 201 });
    case "invalid":
      return NextResponse.json(
        { status: "invalid", fieldErrors: { [result.field === "property" ? "propertyRef" : (result.field ?? "form")]: FIELD_MESSAGES[result.field ?? ""] ?? "Please check your details." } },
        { status: 400 },
      );
    case "rate_limited":
      return NextResponse.json({ status: "rate_limited", error: "We've already received several requests from this page today. The team will be in touch." }, { status: 429 });
    case "revoked":
    case "expired":
      return NextResponse.json({ status: result.status, error: "This link is no longer active." }, { status: 410 });
    default:
      return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
}
