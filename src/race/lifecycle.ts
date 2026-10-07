import { getEffectiveTimeLimitSeconds, parseRaceSettings, type RaceSettings } from "./config";

export const COUNTDOWN_MS = 3_000;

/** Pure lifecycle: its caller owns timers, transport, participants and text validation. */
export type RaceLifecycle =
  | { phase: "preparing"; settings: Readonly<RaceSettings> }
  | { phase: "countdown"; settings: Readonly<RaceSettings>; startsAt: number }
  | { phase: "racing"; settings: Readonly<RaceSettings>; startsAt: number; endsAt: number }
  | { phase: "results"; settings: Readonly<RaceSettings>; startsAt: number; finishedAt: number; reason: "completed" | "timeout" };

export type RaceLifecycleEvent =
  | { type: "start" }
  | { type: "tick" }
  | { type: "complete" }
  | { type: "reset" };

export function createRaceLifecycle(settings: RaceSettings): RaceLifecycle {
  const parsed = parseRaceSettings(settings);
  if (!parsed) throw new Error("INVALID_RACE_SETTINGS");
  return { phase: "preparing", settings: Object.freeze(parsed) };
}

/** COURSE-1, COURSE-3, H-9. Multiplayer callers must check host and runner guards first. */
export function transitionRace(state: RaceLifecycle, event: RaceLifecycleEvent, now: number): RaceLifecycle {
  if (!Number.isFinite(now) || now < 0) throw new Error("INVALID_RACE_TIME");
  if (event.type === "reset") return state.phase === "results" ? createRaceLifecycle(state.settings) : state;
  if (event.type === "start") {
    return state.phase === "preparing" ? { phase: "countdown", settings: state.settings, startsAt: now + COUNTDOWN_MS } : state;
  }
  if (state.phase === "countdown" && event.type === "tick" && now >= state.startsAt) {
    const racing: RaceLifecycle = { phase: "racing", settings: state.settings, startsAt: state.startsAt,
      endsAt: state.startsAt + getEffectiveTimeLimitSeconds(state.settings) * 1000 };
    // An inactive tab may resume after the entire race has elapsed.
    return transitionRace(racing, event, now);
  }
  if (state.phase !== "racing" || now < state.startsAt) return state;
  if (now >= state.endsAt) {
    return { phase: "results", settings: state.settings, startsAt: state.startsAt,
      finishedAt: state.endsAt, reason: "timeout" };
  }
  if (event.type === "complete") {
    return { phase: "results", settings: state.settings, startsAt: state.startsAt,
      finishedAt: now, reason: "completed" };
  }
  return state;
}
