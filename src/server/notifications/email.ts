import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** A provider accepting a message is not proof of delivery; callers record it as "accepted". */
export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      let res: Response;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        throw new EmailProviderError("Email provider unreachable", "unreachable");
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string; name?: string };
      if (!res.ok || !json.id) throw new EmailProviderError("Email provider rejected the message", json.name ?? `http_${res.status}`);
      return { id: json.id };
    },
  };
}

/** Null unless every required setting is present. Nothing pretends to send. */
export function getEmailProvider(): EmailProvider | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? createResendProvider(key, from) : null;
}
