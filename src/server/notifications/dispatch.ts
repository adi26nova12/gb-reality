import "server-only";
import { EmailProviderError, type EmailMessage, type EmailProvider } from "./email";

interface ClaimedEmail {
  recipient_email: string;
  recipient_name: string | null;
  title: string;
  body: string | null;
  lead_id: string | null;
  organisation_name: string | null;
}

/** The two database calls the dispatcher needs; satisfied by a service-role Supabase client. */
export interface NotificationStore {
  rpc(fn: "claim_notification_email", args: { p_notification_id: string }): PromiseLike<{ data: unknown; error: unknown }>;
  rpc(
    fn: "complete_notification_email",
    args: { p_notification_id: string; p_status: "accepted" | "failed"; p_provider_id?: string | null; p_error?: string | null },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export type DispatchOutcome = "accepted" | "failed" | "nothing_to_send";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * The email deliberately carries no buyer contact details: it says something
 * happened and links to the dashboard, where access control applies.
 */
export function buildNotificationEmail(n: ClaimedEmail, siteUrl: string): Omit<EmailMessage, "to"> {
  const link = n.lead_id ? `${siteUrl}/dashboard/enquiries/${n.lead_id}` : `${siteUrl}/dashboard/notifications`;
  const org = n.organisation_name ?? "Clannco";
  const greeting = n.recipient_name ? `Hi ${n.recipient_name.split(/\s+/)[0]},` : "Hello,";
  const text = [greeting, "", n.title, n.body ?? "", "", `Open in Clannco: ${link}`, "", `You receive these because email notifications are on in your ${org} settings.`]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#16191a;max-width:520px">
<p>${escapeHtml(greeting)}</p>
<p style="font-size:16px;font-weight:600;margin:16px 0 4px">${escapeHtml(n.title)}</p>
${n.body ? `<p style="margin:0 0 16px;color:#4a4a45">${escapeHtml(n.body)}</p>` : ""}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f5f47;color:#f8f6f1;padding:10px 16px;border-radius:8px;text-decoration:none">Open in Clannco</a></p>
<p style="font-size:12px;color:#66635d">You receive these because email notifications are on in your ${escapeHtml(org)} settings.</p>
</div>`;
  return { subject: `${n.title} · ${org}`, text, html };
}

export async function dispatchNotificationEmail(
  store: NotificationStore,
  provider: EmailProvider,
  notificationId: string,
  siteUrl: string,
): Promise<DispatchOutcome> {
  const claim = await store.rpc("claim_notification_email", { p_notification_id: notificationId });
  if (claim.error) throw new Error("Could not claim notification");
  const row = (Array.isArray(claim.data) ? claim.data[0] : null) as ClaimedEmail | null;
  if (!row) return "nothing_to_send"; // already handled, or recipient has not opted in

  try {
    const sent = await provider.send({ to: row.recipient_email, ...buildNotificationEmail(row, siteUrl) });
    const done = await store.rpc("complete_notification_email", { p_notification_id: notificationId, p_status: "accepted", p_provider_id: sent.id });
    if (done.error) throw new Error("Could not record email status");
    return "accepted";
  } catch (error) {
    const code = error instanceof EmailProviderError ? error.code : "internal_error";
    await store.rpc("complete_notification_email", { p_notification_id: notificationId, p_status: "failed", p_error: code });
    return "failed";
  }
}
