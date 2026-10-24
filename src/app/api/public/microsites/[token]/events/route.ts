import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isWellFormedToken } from "@/lib/security/tokens";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { trackEventSchema } from "@/lib/validation/schemas";

const MAX_BODY_BYTES = 2048;

/** Buyer engagement ingestion. Validated here and again inside the database. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isWellFormedToken(token)) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (!isSupabaseConfigured()) return NextResponse.json({ status: "unavailable" }, { status: 503 });

  const limit = await rateLimit(`events:${clientKey(request.headers)}:${token}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ status: "invalid" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }
  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ status: "invalid" }, { status: 400 });

  const { data, error } = await createPublicClient().rpc("record_microsite_event", {
    p_token: token,
    p_event_type: parsed.data.eventType,
    p_session_id: parsed.data.sessionId,
    p_property_ref: parsed.data.propertyRef ?? null,
    p_metadata: parsed.data.metadata,
  });
  if (error) {
    console.error("[events] rpc failed", { code: error.code });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  const status = (data as { status: string }).status;
  const code = status === "recorded" || status === "deduplicated" ? 202 : status === "rate_limited" ? 429 : status === "revoked" || status === "expired" ? 410 : status === "not_found" ? 404 : 400;
  return NextResponse.json({ status }, { status: code, headers: { "Cache-Control": "no-store" } });
}
