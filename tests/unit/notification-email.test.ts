import { describe, expect, it } from "vitest";
import { buildNotificationEmail, dispatchNotificationEmail, type NotificationStore } from "@/server/notifications/dispatch";
import { createResendProvider, EmailProviderError, type EmailProvider } from "@/server/notifications/email";

const claimed = {
  recipient_email: "priya@agency.test",
  recipient_name: "Priya Sharma",
  title: "New viewing request",
  body: "Requested for 25 Oct 2026 (morning). Not yet confirmed.",
  lead_id: "11111111-1111-4111-8111-111111111111",
  organisation_name: "Demo <Agency>",
};

function fakeStore(claimResult: unknown[]) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const store: NotificationStore = {
    rpc: ((fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: fn === "claim_notification_email" ? claimResult : null, error: null });
    }) as NotificationStore["rpc"],
  };
  return { store, calls };
}

const provider = (impl: EmailProvider["send"]): EmailProvider => ({ name: "fake", send: impl });

describe("notification email dispatch", () => {
  it("sends once claimed and records the provider's id as accepted", async () => {
    const { store, calls } = fakeStore([claimed]);
    const sent: unknown[] = [];
    const outcome = await dispatchNotificationEmail(store, provider(async (m) => (sent.push(m), { id: "re_123" })), "n1", "https://homes.example.com");
    expect(outcome).toBe("accepted");
    expect(sent).toHaveLength(1);
    expect(calls.at(-1)).toEqual({ fn: "complete_notification_email", args: { p_notification_id: "n1", p_status: "accepted", p_provider_id: "re_123" } });
  });

  it("sends nothing when the claim returns nothing (opted out or already handled)", async () => {
    const { store, calls } = fakeStore([]);
    let sends = 0;
    expect(await dispatchNotificationEmail(store, provider(async () => (sends++, { id: "x" })), "n1", "https://x.test")).toBe("nothing_to_send");
    expect(sends).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("records provider failures as failed with a short code, never as sent", async () => {
    const { store, calls } = fakeStore([claimed]);
    const outcome = await dispatchNotificationEmail(store, provider(async () => { throw new EmailProviderError("rejected", "validation_error"); }), "n1", "https://x.test");
    expect(outcome).toBe("failed");
    expect(calls.at(-1)?.args).toMatchObject({ p_status: "failed", p_error: "validation_error" });
  });

  it("builds an email with a dashboard link, escaped HTML and no buyer contact details", () => {
    const email = buildNotificationEmail(claimed, "https://homes.example.com");
    expect(email.subject).toBe("New viewing request · Demo <Agency>");
    expect(email.text).toContain("https://homes.example.com/dashboard/enquiries/11111111-1111-4111-8111-111111111111");
    expect(email.html).toContain("Demo &lt;Agency&gt;");
    expect(email.html).not.toContain("<Agency>");
    expect(email.text).toMatch(/^Hi Priya,/);
  });
});

describe("Resend provider", () => {
  it("posts the message and returns the provider id", async () => {
    let request: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: "re_abc" }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await createResendProvider("key_1", "Clannco <alerts@agency.test>", fetchImpl).send({ to: "a@b.test", subject: "S", text: "T", html: "<p>T</p>" });
    expect(result).toEqual({ id: "re_abc" });
    expect(request!.url).toBe("https://api.resend.com/emails");
    expect(new Headers(request!.init.headers).get("authorization")).toBe("Bearer key_1");
    expect(JSON.parse(String(request!.init.body))).toMatchObject({ from: "Clannco <alerts@agency.test>", to: ["a@b.test"] });
  });

  it("raises a coded error when the provider rejects or is unreachable", async () => {
    const rejecting = (async () => new Response(JSON.stringify({ name: "invalid_from_address" }), { status: 422 })) as unknown as typeof fetch;
    await expect(createResendProvider("k", "f", rejecting).send({ to: "a@b.test", subject: "", text: "", html: "" })).rejects.toMatchObject({ code: "invalid_from_address" });
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(createResendProvider("k", "f", down).send({ to: "a@b.test", subject: "", text: "", html: "" })).rejects.toMatchObject({ code: "unreachable" });
  });
});
