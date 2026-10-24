const LAKH = 100_000;
const CRORE = 10_000_000;

function trimNumber(n: number, maxFractionDigits = 2): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: maxFractionDigits, minimumFractionDigits: 0 });
}

/** "₹92 L", "₹1.15 Cr" for INR; locale-aware compact format for other currencies. */
export function formatCompactPrice(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Price on request";
  if (currency === "INR") {
    if (amount >= CRORE) return `₹${trimNumber(amount / CRORE)} Cr`;
    if (amount >= LAKH) return `₹${trimNumber(amount / LAKH)} L`;
    return `₹${trimNumber(amount, 0)}`;
  }
  return new Intl.NumberFormat("en", { style: "currency", currency, notation: "compact", maximumFractionDigits: 2 }).format(amount);
}

/** Full amount, e.g. "₹92,00,000". */
export function formatFullPrice(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "Price on request";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatBudgetRange(min: number | null | undefined, max: number | null | undefined, currency = "INR"): string {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) return `${formatCompactPrice(min, currency)} – ${formatCompactPrice(max, currency)}`;
  if (hasMax) return `Up to ${formatCompactPrice(max, currency)}`;
  if (hasMin) return `From ${formatCompactPrice(min, currency)}`;
  return "Not specified";
}

/**
 * Parses amounts the way Indian sales teams write them:
 * "80L", "80 lakh", "1 Cr", "1.2 crore", "85,00,000", "8500000".
 * Returns null for empty input and NaN for input that cannot be understood.
 */
export function parseIndianAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : Number.NaN;
  const value = input.trim().toLowerCase().replace(/^₹|^rs\.?|^inr/, "").trim();
  if (!value) return null;

  const match = value.match(/^([0-9][0-9,]*(?:\.[0-9]+)?)\s*(l|lac|lacs|lakh|lakhs|cr|crore|crores|k)?$/);
  if (!match) return Number.NaN;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return Number.NaN;

  const unit = match[2];
  const multiplier =
    unit === undefined
      ? 1
      : unit.startsWith("c")
        ? CRORE
        : unit === "k"
          ? 1_000
          : LAKH;
  return Math.round(base * multiplier);
}

export function formatArea(area: number | null | undefined, unit: string): string {
  if (area === null || area === undefined) return "—";
  return `${area.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${unit === "sqm" ? "m²" : "sq ft"}`;
}
