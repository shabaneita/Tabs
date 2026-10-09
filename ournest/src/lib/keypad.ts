/** Pure state machine for the amount keypad (string of ASCII digits + "."). */
export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back" | "clear";

export function applyKey(current: string, key: KeypadKey, maxWholeDigits = 9): string {
  if (key === "clear") return "";
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : current + ".";
  }
  const [whole, frac] = current.split(".");
  if (frac !== undefined) {
    return frac.length >= 2 ? current : current + key;
  }
  if (whole === "0") return key; // replace leading zero
  if (whole.length >= maxWholeDigits) return current;
  return current + key;
}
