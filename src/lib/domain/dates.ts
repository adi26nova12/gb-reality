export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function timezoneLabel(timeZone: string = DEFAULT_TIMEZONE): string {
  const part = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  const short = part?.value ?? timeZone;
  return timeZone === "Asia/Kolkata" ? "IST (Asia/Kolkata)" : `${short} (${timeZone})`;
}

export function formatDateTime(value: string | Date | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatTime(value: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/** A plain calendar date (YYYY-MM-DD) — not shifted by any timezone. */
export function formatCalendarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", weekday: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "Never";
  const diff = (now.getTime() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diff) < 60) return "just now";
  if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (Math.abs(diff) < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return formatDate(value);
}

export type RangeKey = "7d" | "30d" | "90d" | "all";
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function parseRange(value: string | string[] | undefined): RangeKey {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "7d" || v === "90d" || v === "all" ? v : "30d";
}

export function rangeBounds(range: RangeKey, now: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getTime() + 60_000);
  if (range === "all") return { from: new Date("2000-01-01T00:00:00Z"), to };
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return { from: new Date(now.getTime() - days * 86_400_000), to };
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Interprets a `datetime-local` value ("2026-10-25T11:00") as wall-clock time in `timeZone`. */
export function zonedLocalToUtc(local: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(Number.NaN);
  const [, y, mo, d, h, mi] = match.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - timezoneOffsetMs(new Date(guess), timeZone);
  const second = guess - timezoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** The inverse of zonedLocalToUtc, for pre-filling `datetime-local` inputs. */
export function utcToZonedLocal(value: string | Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = new Date(value);
  const shifted = new Date(date.getTime() + timezoneOffsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** Today's calendar date (YYYY-MM-DD) in `timeZone`. */
export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return utcToZonedLocal(now, timeZone).slice(0, 10);
}
