import { describe, expect, it } from "vitest";
import { applyKey, type KeypadKey } from "@/lib/keypad";

const type = (keys: KeypadKey[]) => keys.reduce((s, k) => applyKey(s, k), "");

describe("amount keypad", () => {
  it("types amounts", () => {
    expect(type(["1", "2", "5", ".", "5"])).toBe("125.5");
    expect(type([".", "7", "5"])).toBe("0.75");
  });
  it("limits to two decimals and one separator", () => {
    expect(type(["9", ".", "9", "9", "9", "."])).toBe("9.99");
  });
  it("drops leading zeros", () => expect(type(["0", "0", "4"])).toBe("4"));
  it("deletes and clears", () => {
    expect(type(["4", "2", "back"])).toBe("4");
    expect(type(["4", "2", "clear"])).toBe("");
  });
  it("caps whole digits", () => expect(type(Array(12).fill("9") as KeypadKey[])).toBe("999999999"));
});
