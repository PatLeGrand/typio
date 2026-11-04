import { describe, expect, it } from "vitest";
import { DEFAULT_RACE_SETTINGS } from "./config";
import { createRaceLifecycle, transitionRace } from "./lifecycle";

describe("race lifecycle (COURSE-03, COURSE-09, H-9)", () => {
  const prepare = () => createRaceLifecycle(DEFAULT_RACE_SETTINGS);
  const countdown = () => transitionRace(prepare(), { type: "start" }, 1000);
  const racing = () => transitionRace(countdown(), { type: "tick" }, 4000);

  it("does not start early and anchors the clock to the scheduled start", () => {
    const state = countdown();
    expect(transitionRace(state, { type: "tick" }, 3999)).toBe(state);
    expect(transitionRace(state, { type: "tick" }, 4500)).toMatchObject({ phase: "racing", startsAt: 4000, endsAt: 1804000 });
  });
  it("ignores completion before the start and duplicate start events", () => {
    const state = prepare();
    expect(transitionRace(state, { type: "complete" }, 1000)).toBe(state);
    const active = racing();
    expect(transitionRace(active, { type: "start" }, 5000)).toBe(active);
    expect(transitionRace(active, { type: "reset" }, 5000)).toBe(active);
  });
  it("finishes at the deadline even when a timer wakes late", () => {
    expect(transitionRace(countdown(), { type: "tick" }, 1900000)).toMatchObject({ phase: "results", finishedAt: 1804000, reason: "timeout" });
  });
  it("gives expiry precedence over a late completion", () => {
    expect(transitionRace(racing(), { type: "complete" }, 1804000)).toMatchObject({ reason: "timeout" });
  });
  it("keeps an unlimited race running after five minutes and allows completion", () => {
    const state = transitionRace(racing(), { type: "tick" }, 604000);
    expect(state.phase).toBe("racing");
    expect(transitionRace(state, { type: "complete" }, 605000)).toMatchObject({ reason: "completed", finishedAt: 605000 });
  });
  it("finishes normally and resets only from results", () => {
    const result = transitionRace(racing(), { type: "complete" }, 10000);
    expect(result).toMatchObject({ phase: "results", finishedAt: 10000, reason: "completed" });
    expect(transitionRace(result, { type: "reset" }, 11000)).toEqual(prepare());
  });
  it("lets a runner abandon only while racing, and expiry still wins (COURSE-07)", () => {
    const waiting = countdown();
    expect(transitionRace(waiting, { type: "abandon" }, 2000)).toBe(waiting);
    expect(transitionRace(racing(), { type: "abandon" }, 12000)).toMatchObject({ phase: "results", finishedAt: 12000, reason: "abandoned" });
    expect(transitionRace(racing(), { type: "abandon" }, 1804000)).toMatchObject({ reason: "timeout" });
  });
  it("copies settings so later form edits cannot change an active race", () => {
    const settings = { ...DEFAULT_RACE_SETTINGS };
    const state = createRaceLifecycle(settings);
    settings.timeLimitSeconds = 60;
    expect(state.settings.timeLimitSeconds).toBeNull();
    expect(Object.isFrozen(state.settings)).toBe(true);
  });
});
