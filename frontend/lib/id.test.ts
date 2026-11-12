import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("newId", () => {
  it("returns a v4 UUID", () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it("still works when crypto.randomUUID is unavailable (insecure http context)", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(crypto) });
    const first = newId();
    expect(first).toMatch(UUID_V4);
    expect(newId()).not.toBe(first);
  });
});
