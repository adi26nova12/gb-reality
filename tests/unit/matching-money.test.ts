import { describe, expect, it } from "vitest";
import { evaluateBudget, matchProperties, type CandidateProperty } from "@/lib/domain/matching";
import { formatBudgetRange, formatCompactPrice, formatFullPrice, parseIndianAmount } from "@/lib/domain/money";

const DEV = "11111111-1111-4111-8111-111111111111";
const OTHER_DEV = "22222222-2222-4222-8222-222222222222";

function prop(overrides: Partial<CandidateProperty>): CandidateProperty {
  return {
    id: overrides.unitReference ?? "x",
    developmentId: DEV,
    developmentName: "Example Residences",
    unitReference: "A-1",
    configuration: "2BHK",
    price: 9_000_000,
    currency: "INR",
    availabilityStatus: "available",
    archived: false,
    ...overrides,
  };
}

const ahmed = { developmentId: DEV, configuration: "2BHK", budgetMin: 8_000_000, budgetMax: 10_000_000, budgetCurrency: "INR" };

describe("evaluateBudget", () => {
  it("is inclusive at both ends", () => {
    expect(evaluateBudget(8_000_000, "INR", 8_000_000, 10_000_000, "INR")).toBe("within");
    expect(evaluateBudget(10_000_000, "INR", 8_000_000, 10_000_000, "INR")).toBe("within");
  });
  it("flags prices outside the range", () => {
    expect(evaluateBudget(10_000_001, "INR", 8_000_000, 10_000_000, "INR")).toBe("above");
    expect(evaluateBudget(7_999_999, "INR", 8_000_000, 10_000_000, "INR")).toBe("below");
  });
  it("handles open-ended budgets", () => {
    expect(evaluateBudget(50_000_000, "INR", 8_000_000, null, "INR")).toBe("within");
    expect(evaluateBudget(5_000_000, "INR", null, 10_000_000, "INR")).toBe("within");
    expect(evaluateBudget(9_000_000, "INR", null, null, "INR")).toBe("not_specified");
  });
  it("never claims a fit it cannot verify", () => {
    expect(evaluateBudget(null, "INR", 8_000_000, 10_000_000, "INR")).toBe("unknown");
    expect(evaluateBudget(9_000_000, "AED", 8_000_000, 10_000_000, "INR")).toBe("unknown");
  });
});

describe("matchProperties", () => {
  const catalogue = [
    prop({ unitReference: "A-1204", price: 9_200_000 }),
    prop({ unitReference: "A-0802", price: 8_400_000 }),
    prop({ unitReference: "A-1801", price: 11_500_000 }),
    prop({ unitReference: "A-0603", price: 8_500_000, availabilityStatus: "sold" }),
    prop({ unitReference: "A-0101", price: 8_100_000, archived: true }),
    prop({ unitReference: "B-0902", configuration: "3BHK", price: 9_800_000 }),
    prop({ unitReference: "B-1501", configuration: "3BHK", price: 14_000_000 }),
    prop({ unitReference: "Z-0404", developmentId: OTHER_DEV, developmentName: "Aurelia Heights", price: 9_500_000 }),
    prop({ unitReference: "Z-0505", developmentId: OTHER_DEV, developmentName: "Aurelia Heights", price: 12_500_000 }),
  ];

  const result = matchProperties(ahmed, catalogue);

  it("returns exact matches in the development, configuration and budget, cheapest first", () => {
    expect(result.hasExactMatch).toBe(true);
    expect(result.exact.map((m) => m.property.unitReference)).toEqual(["A-0802", "A-1204"]);
    expect(result.exact.every((m) => m.budget === "within")).toBe(true);
  });

  it("never suggests sold, reserved or archived properties", () => {
    const all = [...result.exact, ...result.close, ...result.other].map((m) => m.property.unitReference);
    expect(all).not.toContain("A-0603");
    expect(all).not.toContain("A-0101");
    expect(result.unavailableExcluded).toBe(2);
  });

  it("lists close alternatives with honest reasons", () => {
    expect(result.close.map((m) => m.property.unitReference)).toEqual(["A-1801", "B-0902"]);
    const over = result.close.find((m) => m.property.unitReference === "A-1801")!;
    expect(over.budget).toBe("above");
    expect(over.reasons.join(" ")).toContain("above the budget maximum");
    expect(over.reasons.join(" ")).not.toContain("within");
  });

  it("drops properties that miss on both configuration and budget", () => {
    expect([...result.close, ...result.other].map((m) => m.property.unitReference)).not.toContain("B-1501");
  });

  it("offers other developments only when they fit configuration and budget", () => {
    expect(result.other.map((m) => m.property.unitReference)).toEqual(["Z-0404"]);
  });

  it("reports when there is no exact match", () => {
    const none = matchProperties({ ...ahmed, configuration: "4BHK" }, catalogue);
    expect(none.hasExactMatch).toBe(false);
    expect(none.exact).toEqual([]);
  });

  it("is deterministic regardless of input order", () => {
    const shuffled = [...catalogue].reverse();
    const again = matchProperties(ahmed, shuffled);
    expect(again.exact.map((m) => m.property.id)).toEqual(result.exact.map((m) => m.property.id));
    expect(again.close.map((m) => m.property.id)).toEqual(result.close.map((m) => m.property.id));
  });
});

describe("money", () => {
  it.each([
    ["80L", 8_000_000],
    ["80 lakh", 8_000_000],
    ["1 Cr", 10_000_000],
    ["1.2 crore", 12_000_000],
    ["₹85,00,000", 8_500_000],
    ["8500000", 8_500_000],
    ["Rs. 92 lakhs", 9_200_000],
  ])("parses %s", (input, expected) => {
    expect(parseIndianAmount(input)).toBe(expected);
  });

  it("returns null for empty and NaN for nonsense", () => {
    expect(parseIndianAmount("")).toBeNull();
    expect(parseIndianAmount(undefined)).toBeNull();
    expect(parseIndianAmount("about a crore")).toBeNaN();
  });

  it("formats in lakh and crore", () => {
    expect(formatCompactPrice(9_200_000)).toBe("₹92 L");
    expect(formatCompactPrice(11_500_000)).toBe("₹1.15 Cr");
    expect(formatCompactPrice(null)).toBe("Price on request");
    expect(formatFullPrice(9_200_000)).toBe("₹92,00,000");
    expect(formatBudgetRange(8_000_000, 10_000_000)).toBe("₹80 L – ₹1 Cr");
    expect(formatBudgetRange(null, 10_000_000)).toBe("Up to ₹1 Cr");
    expect(formatBudgetRange(null, null)).toBe("Not specified");
  });
});
