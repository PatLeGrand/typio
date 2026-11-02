import { describe, expect, it } from "vitest";
import { historyOffset, historyPage, isRaceId, MAX_HISTORY_PAGE, parseHistoryPage } from "./raceHistory";

describe("history route validators", () => {
  it.each([undefined, null, [], ["2"], "", "0", "000", "-1", "+2", "1.5", "1e2", " 2", "2 ", "2\n", "abc"])("defaults invalid page %j to 1", (value) => {
    expect(parseHistoryPage(value)).toBe(1);
  });

  it("accepts digits and caps large pages before computing the offset", () => {
    expect(parseHistoryPage("1")).toBe(1);
    expect(parseHistoryPage("002")).toBe(2);
    expect(parseHistoryPage("10001")).toBe(MAX_HISTORY_PAGE);
    expect(parseHistoryPage("9".repeat(400))).toBe(MAX_HISTORY_PAGE);
    expect(historyOffset(parseHistoryPage("9999999999999999999"), 20)).toBe(199_980);
  });

  it("accepts UUIDs in either case and rejects malformed or non-string identifiers", () => {
    expect(isRaceId("12345678-abcd-4321-abcd-123456789012")).toBe(true);
    expect(isRaceId("12345678-ABCD-4321-ABCD-123456789012")).toBe(true);
    for (const value of [undefined, null, [], "", "12345678-abcd-4321-abcd-12345678901g", "12345678abcd4321abcd123456789012", "12345678-abcd-4321-abcd-123456789012\n"]) {
      expect(isRaceId(value)).toBe(false);
    }
  });
});

describe("history pagination", () => {
  it("offsets from the first page without skipping or repeating rows", () => {
    expect(historyOffset(1, 20)).toBe(0);
    expect(historyOffset(2, 20)).toBe(20);
    expect(historyOffset(3, 20)).toBe(40);
  });

  it("uses the extra row only to detect a next page", () => {
    expect(historyPage([1, 2, 3], 2)).toEqual({ items: [1, 2], hasNext: true });
    expect(historyPage([1, 2], 2)).toEqual({ items: [1, 2], hasNext: false });
    expect(historyPage([1], 2)).toEqual({ items: [1], hasNext: false });
    expect(historyPage([], 2)).toEqual({ items: [], hasNext: false });
  });
});
