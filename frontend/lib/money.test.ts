import { describe, expect, it } from "vitest";
import {
  formatSatang,
  fromApiString,
  parseAmount,
  splitEqually,
  sum,
  toApiString,
} from "./money";

const satang = (raw: string) => {
  const result = parseAmount(raw);
  if (!result.ok) throw new Error(`invalid ${raw}`);
  return result.satang;
};

describe("splitEqually", () => {
  it("splits 100.00 three ways as 33.34, 33.33, 33.33 like the backend", () => {
    const shares = splitEqually(satang("100.00"), 3);
    expect(shares.map(formatSatang)).toEqual(["33.34", "33.33", "33.33"]);
    expect(sum(shares)).toBe(10000);
  });

  it("gives the remaining satang to the first members in order", () => {
    expect(splitEqually(satang("0.05"), 3).map(formatSatang)).toEqual(["0.02", "0.02", "0.01"]);
  });

  it("splits 1,000.00 three ways as in the brief", () => {
    expect(splitEqually(satang("1000.00"), 3).map(formatSatang)).toEqual([
      "333.34",
      "333.33",
      "333.33",
    ]);
  });

  it("returns nothing for zero members", () => {
    expect(splitEqually(100, 0)).toEqual([]);
  });
});

describe("no floating point error", () => {
  it("0.1 + 0.2 displays 0.30", () => {
    expect(formatSatang(sum([satang("0.1"), satang("0.2")]))).toBe("0.30");
  });
});

describe("formatSatang", () => {
  it("uses Thai thousands grouping with two decimals", () => {
    expect(formatSatang(100000)).toBe("1,000.00");
    expect(formatSatang(123456789)).toBe("1,234,567.89");
    expect(formatSatang(5)).toBe("0.05");
    expect(formatSatang(-33333)).toBe("-333.33");
    expect(formatSatang(0)).toBe("0.00");
  });
});

describe("parseAmount", () => {
  it("accepts up to two decimals and thousands separators", () => {
    expect(satang("1000")).toBe(100000);
    expect(satang("1,000.5")).toBe(100050);
    expect(satang("0.01")).toBe(1);
  });

  it("rejects more than two decimals", () => {
    expect(parseAmount("10.005")).toEqual({ ok: false, reason: "too_many_decimals" });
  });

  it("rejects zero, negatives and junk", () => {
    expect(parseAmount("0")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseAmount("-1")).toEqual({ ok: false, reason: "not_positive" });
    expect(parseAmount("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAmount("")).toEqual({ ok: false, reason: "empty" });
    expect(parseAmount("1e3")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("parseAmount while typing and with separators", () => {
  it("accepts a trailing or leading decimal point", () => {
    expect(satang("1000.")).toBe(100000);
    expect(satang(".5")).toBe(50);
  });

  it("only accepts commas as proper thousands separators", () => {
    expect(satang("1,000")).toBe(100000);
    expect(satang("12,345,678.9")).toBe(1234567890);
    // "0,5" is a European decimal comma; silently reading it as 5.00 would be 10x wrong.
    expect(parseAmount("0,5")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAmount("1,00")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAmount("1,0000")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAmount(",100")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a lone dot and non-ASCII digits", () => {
    expect(parseAmount(".")).toEqual({ ok: false, reason: "invalid" });
    expect(parseAmount("１２３")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("API string conversion", () => {
  it("round-trips balances including negatives", () => {
    expect(fromApiString("-333.33")).toBe(-33333);
    expect(fromApiString("666.66")).toBe(66666);
    expect(toApiString(100000)).toBe("1000.00");
  });
});
