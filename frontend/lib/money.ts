/**
 * Money helpers. Every amount is an integer number of satang (1 THB = 100 satang), so there is
 * no floating-point arithmetic anywhere: 0.1 + 0.2 is 10 + 20 = 30 satang, displayed "0.30".
 * The parsing and allocation rules mirror backend/app/services/money.py exactly.
 */

export type Satang = number;

export type ParseResult =
  | { ok: true; satang: Satang }
  | { ok: false; reason: "empty" | "invalid" | "too_many_decimals" | "not_positive" | "too_large" };

// Digits with optional thousands commas (only proper groups of three), then an optional
// fraction. A trailing or leading "." is allowed so typing "1000." does not flash an error.
// "[0-9]" rather than "\d" keeps non-ASCII digits out. "0,5" is rejected on purpose:
// reading a European decimal comma as a thousands separator would be 10x wrong.
const AMOUNT_RE = /^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)?(?:\.[0-9]*)?$/;
const MAX_SATANG = 999_999_999_999; // NUMERIC(12,2) maximum, 9,999,999,999.99

export function parseAmount(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  if (trimmed.startsWith("-")) return { ok: false, reason: "not_positive" };
  if (!AMOUNT_RE.test(trimmed) || !/[0-9]/.test(trimmed)) return { ok: false, reason: "invalid" };
  const [whole, fraction = ""] = trimmed.replace(/,/g, "").split(".");
  if (fraction.length > 2) return { ok: false, reason: "too_many_decimals" };
  const satang = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (satang <= 0) return { ok: false, reason: "not_positive" };
  if (satang > MAX_SATANG) return { ok: false, reason: "too_large" };
  return { ok: true, satang };
}

/** Thai formatting: thousands separated by commas, always two decimals ("1,000.00"). */
export function formatSatang(satang: Satang): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/** Parse a backend money string such as "-333.33" (balances may be negative). */
export function fromApiString(value: string): Satang {
  const negative = value.startsWith("-");
  const result = parseAmount(negative ? value.slice(1) : value);
  const satang = result.ok ? result.satang : 0;
  return negative ? -satang : satang;
}

/** Equal split: leftover satang go one at a time to members in the listed order. */
export function splitEqually(total: Satang, count: number): Satang[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function sum(values: Satang[]): Satang {
  return values.reduce((acc, value) => acc + value, 0);
}

/** Decimal string sent to the API, e.g. 100000 -> "1000.00" (no thousands separators). */
export function toApiString(satang: Satang): string {
  return formatSatang(satang).replace(/,/g, "");
}
