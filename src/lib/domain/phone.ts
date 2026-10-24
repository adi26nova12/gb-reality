import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_COUNTRY: CountryCode = "IN";

export type PhoneResult =
  | { ok: true; e164: string; international: string; country: string | undefined }
  | { ok: false; error: string };

/**
 * Normalises user-entered phone numbers to E.164 (e.g. +919812345678).
 * Numbers without a country code are interpreted in `defaultCountry`.
 */
export function normalisePhone(input: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Enter a mobile number" };
  if (/[a-z]/i.test(raw)) return { ok: false, error: "Phone numbers can only contain digits, spaces, +, - and brackets" };

  // "00" is the international dialling prefix in most countries.
  const cleaned = raw.replace(/^00(?=[1-9])/, "+");
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: "Enter a valid mobile number including the country code, e.g. +91 98123 45678" };
  }
  return {
    ok: true,
    e164: parsed.number,
    international: parsed.formatInternational(),
    country: parsed.country,
  };
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Digits only, as required by wa.me links. */
export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
