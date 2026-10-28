import { afterEach, describe, expect, it, vi } from "vitest";
import { createRaceInputBuffer, raceInputOps } from "./raceInput";

afterEach(() => vi.useRealTimers());

describe("raceInputOps", () => {
  it.each([
    ["ab", "abcd", ["c", "d"]],
    ["abcd", "ab", ["\b", "\b"]],
    ["abcd", "axy", ["\b", "\b", "\b", "x", "y"]],
    ["a😀é", "a😀ê🚀", ["\b", "ê", "\uD83D", "\uDE80"]],
    ["", "😀", ["\uD83D", "\uDE00"]],
    ["😀", "😁", ["\b", "\uDE01"]],
    ["😀", "", ["\b", "\b"]],
    ["abc", "abc", []],
  ] as const)("converts %s → %s into UTF-16 unit operations", (previous, next, ops) => {
    expect(raceInputOps(previous, next)).toEqual(ops);
  });
});

describe("input buffer", () => {
  it("groups typing, caps batches at 64 and spaces every message by 100 ms", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const buffer = createRaceInputBuffer(send);
    buffer.push(Array(63).fill("a"));
    vi.advanceTimersByTime(50);
    buffer.push(["\uD83D", "\uDE00", "b", "c"]);
    vi.advanceTimersByTime(49);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send.mock.calls).toEqual([[Array(63).fill("a").concat("\uD83D")]]);
    vi.advanceTimersByTime(99);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(send.mock.calls[1]).toEqual([["\uDE00", "b", "c"]]);
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("drops queued operations and cancels its timer on reset", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const buffer = createRaceInputBuffer(send);
    buffer.push(["a"]);
    buffer.clear();
    vi.advanceTimersByTime(100);
    expect(send).not.toHaveBeenCalled();
    buffer.push(["b"]);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledWith(["b"]);
  });
});
