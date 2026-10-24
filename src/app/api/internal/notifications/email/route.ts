import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env";
import { getEmailProvider } from "@/server/notifications/email";
import { dispatchNotificationEmail, type NotificationStore } from "@/server/notifications/dispatch";

/**
 * Called by a Supabase Database Webhook on INSERT into public.notifications.
 * The webhook must send `Authorization: Bearer <NOTIFICATIONS_WEBHOOK_SECRET>`.
 */
const payloadSchema = z.object({
  type: z.literal("INSERT"),
  table: z.literal("notifications"),
  record: z.object({ id: z.uuid() }),
});

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFICATIONS_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ status: "not_configured" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"), secret)) return NextResponse.json({ status: "unauthorised" }, { status: 401 });

  const admin = getAdminClient();
  const provider = getEmailProvider();
  if (!admin || !provider) return NextResponse.json({ status: "not_configured" }, { status: 503 });

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "ignored" }, { status: 200 });

  try {
    const outcome = await dispatchNotificationEmail(admin as unknown as NotificationStore, provider, parsed.data.record.id, getSiteUrl(request.nextUrl.origin));
    return NextResponse.json({ status: outcome }, { status: 200 });
  } catch {
    console.error("[notification-email] dispatch failed");
    // 500 lets Supabase retry; the claim step makes retries safe.
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
