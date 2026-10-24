import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken, generateMicrositeToken, hashToken, isWellFormedToken, TokenSecretError } from "@/lib/security/tokens";
import { advanceStatus } from "@/lib/domain/lead-status";
import { describeEvent } from "@/lib/domain/events";
import { todayIn, utcToZonedLocal, zonedLocalToUtc } from "@/lib/domain/dates";
import { leadSchema, micrositeSelectionSchema, trackEventSchema, viewingRequestSchema, fieldErrors } from "@/lib/validation/schemas";

const secret = randomBytes(32).toString("base64");
const DEV = "11111111-1111-4111-8111-111111111111";

describe("microsite tokens", () => {
  it("are long, random and URL-safe", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateMicrositeToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toHaveLength(43);
      expect(isWellFormedToken(t)).toBe(true);
    }
  });

  it("hash deterministically to 64 hex characters", () => {
    const t = generateMicrositeToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(hashToken(generateMicrositeToken()));
  });

  it("rejects malformed tokens before any lookup", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("../../etc/passwd/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isWellFormedToken("a".repeat(200))).toBe(false);
  });

  it("round-trips through encryption and detects tampering", () => {
    const t = generateMicrositeToken();
    const sealed = encryptToken(t, secret);
    expect(sealed).not.toContain(t);
    expect(decryptToken(sealed, secret)).toBe(t);

    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered!").toString("base64url");
    expect(() => decryptToken(parts.join("."), secret)).toThrow();
    expect(() => decryptToken(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("requires a correctly sized secret", () => {
    expect(() => encryptToken("x", undefined)).toThrow(TokenSecretError);
    expect(() => encryptToken("x", "too-short")).toThrow(TokenSecretError);
  });
});

describe("lead form validation", () => {
  const valid = { buyerName: "Ahmed Khan", phone: "098123 45678", developmentId: DEV, configuration: "2BHK", budgetMin: "80L", budgetMax: "1Cr" };

  it("normalises the phone number and parses budgets", () => {
    const r = leadSchema.parse(valid);
    expect(r.phone).toBe("+919812345678");
    expect(r.budgetMin).toBe(8_000_000);
    expect(r.budgetMax).toBe(10_000_000);
    expect(r.email).toBeNull();
    expect(r.contactPreference).toBe("whatsapp");
  });

  it("does not require email for WhatsApp buyers but does for email contact", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
    const r = leadSchema.safeParse({ ...valid, contactPreference: "email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toMatch(/email/);
  });

  it("reports missing required fields", () => {
    const r = leadSchema.safeParse({ buyerName: " ", phone: "", developmentId: "", configuration: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errors = fieldErrors(r.error);
      expect(Object.keys(errors).sort()).toEqual(["buyerName", "configuration", "developmentId", "phone"]);
    }
  });

  it("rejects invalid phone, email, budget order and unknown configurations", () => {
    const r = leadSchema.safeParse({ ...valid, phone: "12345", email: "not-an-email", budgetMin: "2Cr", budgetMax: "1Cr", configuration: "9BHK" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errors = fieldErrors(r.error);
      expect(errors.phone).toBeDefined();
      expect(errors.email).toBeDefined();
      expect(errors.configuration).toBeDefined();
    }
    const order = leadSchema.safeParse({ ...valid, budgetMin: "2Cr", budgetMax: "1Cr" });
    expect(order.success).toBe(false);
    if (!order.success) expect(fieldErrors(order.error).budgetMax).toMatch(/at least the minimum/);
  });

  it("treats 'none' selections as unset", () => {
    const r = leadSchema.parse({ ...valid, propertyType: "none", assignedAgentId: "none", purchaseTimeframe: "" });
    expect(r.propertyType).toBeNull();
    expect(r.assignedAgentId).toBeNull();
    expect(r.purchaseTimeframe).toBeNull();
  });
});

describe("public input validation", () => {
  const sessionId = "6f1c1f0e-8f1c-4b8e-9a51-0e7c2a0c1a11";

  it("accepts known buyer events only", () => {
    expect(trackEventSchema.safeParse({ eventType: "floor_plan_opened", sessionId, propertyRef: "0a1b2c3d4e" }).success).toBe(true);
    expect(trackEventSchema.safeParse({ eventType: "marked_contacted", sessionId }).success).toBe(false);
    expect(trackEventSchema.safeParse({ eventType: "microsite_opened", sessionId: "not-a-uuid" }).success).toBe(false);
    expect(trackEventSchema.safeParse({ eventType: "brochure_page_viewed", sessionId, metadata: { page: 3, email: "x@y.z" } }).success).toBe(false);
  });

  it("validates viewing requests and normalises the phone", () => {
    const r = viewingRequestSchema.parse({ name: "Ahmed", phone: "+91 98123 45678", preferredDate: "2026-11-02", timeRange: "morning", propertyRef: "any", sessionId });
    expect(r.phone).toBe("+919812345678");
    expect(r.propertyRef).toBeNull();
    expect(viewingRequestSchema.safeParse({ name: "", phone: "1", preferredDate: "soon", timeRange: "night", sessionId }).success).toBe(false);
  });

  it("limits microsite selections", () => {
    const id = () => crypto.randomUUID();
    const leadId = id();
    expect(micrositeSelectionSchema.safeParse({ leadId, propertyIds: [] }).success).toBe(false);
    expect(micrositeSelectionSchema.safeParse({ leadId, propertyIds: Array.from({ length: 13 }, id) }).success).toBe(false);
    const dup = id();
    expect(micrositeSelectionSchema.safeParse({ leadId, propertyIds: [dup, dup] }).success).toBe(false);
    expect(micrositeSelectionSchema.parse({ leadId, propertyIds: [id()] }).expiry).toBe("60");
  });
});

describe("lead status", () => {
  it("only advances forward and respects terminal states", () => {
    expect(advanceStatus("new", "engaged")).toBe("engaged");
    expect(advanceStatus("viewing_requested", "engaged")).toBe("viewing_requested");
    expect(advanceStatus("lost", "engaged")).toBe("lost");
    expect(advanceStatus("converted", "viewing_requested")).toBe("converted");
  });
});

describe("timeline descriptions", () => {
  it("stay factual about what was observed", () => {
    expect(describeEvent({ eventType: "brochure_page_viewed", metadata: { page: 4 }, propertyLabel: null, actorName: null })).toBe("Brochure page 4 displayed");
    expect(describeEvent({ eventType: "whatsapp_initiated", metadata: {}, propertyLabel: null, actorName: "Priya" })).toContain("sending not confirmed");
  });
});

describe("timezones", () => {
  it("converts IST wall-clock time to UTC and back", () => {
    const utc = zonedLocalToUtc("2026-10-25T11:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-10-25T05:30:00.000Z");
    expect(utcToZonedLocal(utc, "Asia/Kolkata")).toBe("2026-10-25T11:00");
  });

  it("handles daylight-saving zones", () => {
    expect(zonedLocalToUtc("2026-07-01T09:00", "Europe/Dublin").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T09:00", "Europe/Dublin").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("computes today's date in the organisation's timezone", () => {
    expect(todayIn("Asia/Kolkata", new Date("2026-10-19T20:00:00Z"))).toBe("2026-10-20");
  });
});
