import { describe, expect, it } from "vitest";
import { formatPhone, normalisePhone, phoneDigits } from "@/lib/domain/phone";
import { buildWhatsAppMessage, buildWhatsAppUrl, firstName } from "@/lib/domain/whatsapp";

describe("normalisePhone", () => {
  it.each([
    ["+91 98123 45678", "+919812345678"],
    ["098123 45678", "+919812345678"],
    ["98123-45678", "+919812345678"],
    ["(+91) 98123 45678", "+919812345678"],
    ["0091 98123 45678", "+919812345678"],
    ["+971 50 123 4567", "+971501234567"],
    ["+44 7911 123456", "+447911123456"],
  ])("normalises %s to %s", (input, expected) => {
    const result = normalisePhone(input);
    expect(result).toMatchObject({ ok: true, e164: expected });
  });

  it.each(["", "   ", "12345", "+91 12345", "call me", "+999 1234567"])("rejects %j", (input) => {
    expect(normalisePhone(input).ok).toBe(false);
  });

  it("formats for display and strips to digits", () => {
    expect(formatPhone("+919812345678")).toBe("+91 98123 45678");
    expect(phoneDigits("+919812345678")).toBe("919812345678");
  });
});

describe("WhatsApp click-to-chat", () => {
  const message = buildWhatsAppMessage({
    buyerName: "Ahmed Khan",
    developmentName: "Example Residences",
    configuration: "2BHK",
    micrositeUrl: "https://homes.example.com/p/abc_DEF-123",
    agentName: "Priya Sharma",
  });

  it("personalises the message with real values and no placeholders", () => {
    expect(message.startsWith("Hi Ahmed, thank you for your interest in Example Residences.")).toBe(true);
    expect(message).toContain("available 2BHK homes");
    expect(message).toContain("https://homes.example.com/p/abc_DEF-123");
    expect(message).toContain("Priya Sharma\nExample Residences");
    expect(message).not.toMatch(/\[[A-Z_]+\]/);
  });

  it("omits the agent line when no agent name is stored", () => {
    const m = buildWhatsAppMessage({ buyerName: "Ahmed", developmentName: "Example Residences", configuration: "2BHK", micrositeUrl: "https://x.test/p/t" });
    expect(m.endsWith("Best regards,\nExample Residences")).toBe(true);
  });

  it("builds a wa.me URL with digits only and an encoded message", () => {
    const url = buildWhatsAppUrl("+91 98123-45678", message);
    expect(url.startsWith("https://wa.me/919812345678?text=")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/919812345678");
    expect(parsed.searchParams.get("text")).toBe(message);
  });

  it("encodes characters that would otherwise break the URL", () => {
    const tricky = "Hi & welcome? 100% #1 — ₹80 L\nline two";
    const url = buildWhatsAppUrl("+919812345678", tricky);
    expect(url).toContain("%26");
    expect(url).toContain("%3F");
    expect(url).toContain("%25");
    expect(url).toContain("%23");
    expect(url).toContain("%0A");
    expect(url).not.toContain(" ");
    expect(new URL(url).searchParams.get("text")).toBe(tricky);
  });

  it("refuses to build a link for an invalid number", () => {
    expect(() => buildWhatsAppUrl("12345", "hi")).toThrow(/valid mobile number/);
  });

  it("uses only the first name", () => {
    expect(firstName("  Ahmed   Khan ")).toBe("Ahmed");
  });
});

describe("dependency-free E.164 display", async () => {
  const { displayE164, e164Digits } = await import("@/lib/domain/phone-format");
  it("matches the full formatter for Indian mobiles and passes others through", () => {
    expect(displayE164("+919812345678")).toBe(formatPhone("+919812345678"));
    expect(displayE164("+971501234567")).toBe("+971501234567");
    expect(e164Digits("+919812345678")).toBe("919812345678");
  });
});
