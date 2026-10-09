import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGraceTimers } from "./graceTimers";

describe("graceTimers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once after the delay", () => {
    const timers = createGraceTimers();
    const onExpire = vi.fn();
    timers.arm("u1", 1000, onExpire);

    vi.advanceTimersByTime(999);
    expect(onExpire).not.toHaveBeenCalled();
    expect(timers.size).toBe(1);

    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(timers.size).toBe(0);
  });

  it("re-arming the same key replaces the previous timer instead of orphaning it", () => {
    const timers = createGraceTimers();
    const first = vi.fn();
    const second = vi.fn();
    timers.arm("u1", 1000, first);
    timers.arm("u1", 1000, second);

    expect(timers.size).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents the callback and ignores unknown keys", () => {
    const timers = createGraceTimers();
    const onExpire = vi.fn();
    timers.arm("u1", 1000, onExpire);
    timers.cancel("u1");
    timers.cancel("unknown");

    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(timers.size).toBe(0);
  });

  it("keeps one timer per key", () => {
    const timers = createGraceTimers();
    const a = vi.fn();
    const b = vi.fn();
    timers.arm("a", 1000, a);
    timers.arm("b", 2000, b);

    vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(timers.size).toBe(1);
  });

  it("close clears everything and refuses later timers", () => {
    const timers = createGraceTimers();
    const onExpire = vi.fn();
    timers.arm("u1", 1000, onExpire);
    timers.close();
    timers.arm("u2", 1000, onExpire);

    expect(timers.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("two registries never share timers", () => {
    const one = createGraceTimers();
    const two = createGraceTimers();
    one.arm("u1", 1000, vi.fn());
    expect(two.size).toBe(0);
    one.close();
  });
});
