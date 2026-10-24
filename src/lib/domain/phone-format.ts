/**
 * Dependency-free helpers for numbers that are already stored in E.164.
 * Used on the buyer microsite to keep its bundle small (no libphonenumber).
 */
export function e164Digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function displayE164(e164: string): string {
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return e164;
}
