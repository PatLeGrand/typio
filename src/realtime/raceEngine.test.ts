import { describe, expect, it } from "vitest";
import { botFinishMs, botKeystrokesAt, botProgressAt } from "@/race/bots";
import { COUNTDOWN_MS } from "@/race/lifecycle";
import { DEFAULT_ROOM_CONFIG, type RoomState } from "./protocol";
import {
  abandonRace, applyInput, expireRunner, raceResults, raceSnapshot,
  setRunnerConnected, startRace, tickRace, type RaceState,
} from "./raceEngine";

const NOW = 1_000;
const START = NOW + COUNTDOWN_MS;
function room(): RoomState {
  return {
    code: "ABCDEF", status: "waiting", hostId: "host", maxRunners: 20,
    config: { ...DEFAULT_ROOM_CONFIG, length: "short" },
    participants: ["host", "guest"].map((id) => ({
      userId: id, displayName: id, kind: "member", role: "runner", connected: true, joinedAt: NOW,
    })),
  };
}
function started(source = room()): RaceState {
  const result = startRace(source, "host", NOW, 42);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function racing(text = "abc", source = room()): RaceState {
  return tickRace({ ...started(source), text }, START);
}
function input(race: RaceState, ops: readonly string[], now = START + 1_000, id = "host"): RaceState {
  const result = applyInput(race, id, ops, now);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

// Ces gardes protègent les droits de l’hôte et le minimum de coureurs (COURSE-02).
describe("startRace", () => {
  it.each(["countdown", "racing", "results", "closed"] as const)("rejects a %s room", (status) => {
    expect(startRace({ ...room(), status }, "host", NOW, 42)).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
  });
  it("requires the host, present and connected", () => {
    expect(startRace(room(), "guest", NOW, 42)).toEqual({ ok: false, error: "NOT_HOST" });
    const source = room();
    source.participants[0].connected = false;
    expect(startRace(source, "host", NOW, 42)).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    source.participants.shift();
    expect(startRace(source, "host", NOW, 42)).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
  });
  it("rejects one human and excludes spectators, even with bots but no human runner", () => {
    const source = room();
    source.participants.pop();
    expect(startRace(source, "host", NOW, 42)).toEqual({ ok: false, error: "NOT_ENOUGH_RUNNERS" });
    const spectators = room();
    spectators.participants.forEach((p) => { p.role = "spectator"; });
    expect(startRace(spectators, "host", NOW, 42)).toEqual({ ok: false, error: "NOT_ENOUGH_RUNNERS" });
    spectators.config.botCount = 2;
    expect(startRace(spectators, "host", NOW, 42)).toEqual({ ok: false, error: "NOT_ENOUGH_RUNNERS" });
  });
  it("allows a spectator host with two runners", () => {
    const source = room();
    source.participants[0].role = "spectator";
    source.config.botCount = 1;
    expect(started(source).runners.map((r) => r.id)).toEqual(["guest", "bot-0"]);
  });
  it("allows one human and one bot, revealing deterministic text and plans at countdown", () => {
    const source = room();
    source.participants.pop();
    source.config.botCount = 1;
    const before = structuredClone(source);
    const race = started(source);
    expect(race).toEqual(started(source));
    expect(source).toEqual(before);
    expect(race.status).toBe("countdown");
    expect(race.startAt).toBe(START);
    expect(race.text.length).toBeGreaterThan(0);
    expect(race.runners.map((r) => r.kind)).toEqual(["human", "bot"]);
    expect(race.runners[1].id).toBe("bot-0");
    expect(race.runners[1].name.length).toBeGreaterThan(0);
    expect(race.timeLimitMs).toBe(300_000);
    source.config.timeLimitSeconds = 60;
    expect(started(source).timeLimitMs).toBe(60_000);
  });
  it("returns NO_TEXT_AVAILABLE when exclusions empty the pool", () => {
    const source = room();
    source.config.excludedCharacters = "abcdefghijklmnopqrstuvwxyz";
    expect(startRace(source, "host", NOW, 42)).toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
  });
});

// Le rejeu et le refus atomique protègent la progression faisant autorité (COURSE-06, CONF-08).
describe("applyInput", () => {
  it("rejects before startAt and accepts at startAt without a prior tick", () => {
    const race = started();
    expect(applyInput(race, "host", ["a"], START - 1)).toEqual({ ok: false, state: race, error: "RACE_NOT_RUNNING" });
    expect(applyInput({ ...race, status: "racing" }, "host", ["a"], START - 1).ok).toBe(false);
    expect(applyInput(race, "host", ["a"], START).ok).toBe(true);
  });
  it("replays free-mode errors and correction without erasing mistake counters", () => {
    const race = racing();
    const before = structuredClone(race);
    const next = input(race, ["x", "b", "\b", "\b", "a"]);
    expect(next.runners[0]).toMatchObject({ typed: "a", position: 1, inputCount: 5,
      keystrokes: { total: 3, correct: 2 }, lastActivityAt: START + 1_000 });
    expect(race).toEqual(before);
  });
  it("blocks wrong characters while counting their errors", () => {
    const source = room();
    source.config.inputMode = "blocking";
    const next = input(racing("abc", source), ["x", "a", "x", "b"]);
    expect(next.runners[0]).toMatchObject({ typed: "ab", position: 2, keystrokes: { total: 4, correct: 2 } });
  });
  it("counts and deletes emoji as two UTF-16 units", () => {
    const race = input(racing(), ["\uD83D", "\uDE00"]);
    expect(race.runners[0]).toMatchObject({ typed: "😀", inputCount: 2, keystrokes: { total: 2, correct: 0 } });
    const next = input(race, ["\b"]);
    expect(next.runners[0].typed).toBe("\uD83D");
    expect(input(next, ["\b"]).runners[0]).toMatchObject({ typed: "", inputCount: 4, keystrokes: { total: 2, correct: 0 } });
  });
  it.each([
    { ops: Array(16).fill("a"), now: START },
    { ops: Array(16).fill("\b"), now: START },
    { ops: Array(65).fill("a"), now: START + 10_000 },
    { ops: ["ab"], now: START + 10_000 },
    { ops: ["😀"], now: START + 10_000 },
    { ops: [""], now: START + 10_000 },
  ])(
    "atomically rejects invalid batches or impossible cadence (%j)", ({ ops, now }) => {
      const race = racing("a".repeat(100));
      const before = structuredClone(race);
      const result = applyInput(race, "host", ops, now);
      expect(result).toEqual({ ok: false, state: tickRace(race, now), error: "INPUT_REJECTED" });
      expect(result.state.runners[0]).toEqual({ ...race.runners[0], wpmSeries: tickRace(race, now).runners[0].wpmSeries });
      expect(race).toEqual(before);
    },
  );
  it("enforces cumulative cadence across batches including wrong blocked characters", () => {
    const source = room();
    source.config.inputMode = "blocking";
    const race = input(racing("abc", source), Array(15).fill("x"), START);
    expect(applyInput(race, "host", ["x"], START)).toEqual({ ok: false, state: tickRace(race, START), error: "INPUT_REJECTED" });
    expect(applyInput(race, "host", ["a"], START + 40).ok).toBe(true);
  });
  it("rejects spectators, unknown users, bots, disconnected and terminal runners", () => {
    const race = racing();
    expect(applyInput(race, "outsider", ["a"], START).ok).toBe(false);
    const source = room();
    source.participants[1].role = "spectator";
    source.config.botCount = 1;
    const withBot = tickRace(started(source), START);
    for (const id of ["guest", "bot-0"]) expect(applyInput(withBot, id, ["a"], START).ok).toBe(false);
    const disconnected = setRunnerConnected(race, "host", false, START);
    expect(applyInput(disconnected, "host", ["a"], START).ok).toBe(false);
    expect(applyInput(abandonRace(race, "host", START), "host", ["a"], START).ok).toBe(false);
    expect(applyInput(input(race, ["a", "b", "c"]), "host", ["a"], START + 2_000).ok).toBe(false);
  });
  it("finishes only with the complete correct text and freezes arrival time", () => {
    let race = input(racing(), ["a", "x", "c"]);
    expect(race.runners[0].status).toBe("typing");
    race = input(race, ["\b", "\b", "b", "c"], START + 2_000);
    expect(race.runners[0]).toMatchObject({ status: "finished", position: 3, finishedAt: START + 2_000 });
    expect(race.status).toBe("racing");
  });
  it("does not accept input at or after the deadline", () => {
    const race = racing();
    expect(applyInput(race, "host", ["a"], START + race.timeLimitMs)).toEqual({ ok: false, state: tickRace(race, START + race.timeLimitMs), error: "RACE_NOT_RUNNING" });
  });
});

describe("lifecycle and disconnection", () => {
  it("starts at exactly startAt, and ends when everyone finishes or abandons", () => {
    const countdown = { ...started(), text: "abc" };
    expect(tickRace(countdown, START - 1)).toBe(countdown);
    let race = input(tickRace(countdown, START), ["a", "b", "c"]);
    race = abandonRace(race, "guest", START + 2_000);
    expect(race).toMatchObject({ status: "results", endedAt: START + 2_000 });
    expect(tickRace(race, START + 9_000)).toBe(race);
    const allFinished = input(input(racing(), ["a", "b", "c"]), ["a", "b", "c"], START + 2_000, "guest");
    expect(allFinished.status).toBe("results");
  });
  it("freezes abandoned progression and metrics", () => {
    const race = abandonRace(input(racing(), ["a"]), "host", START + 2_000);
    expect(race.runners[0]).toMatchObject({ status: "abandoned", position: 1, abandonedAt: START + 2_000 });
    expect(raceSnapshot(race, START + 3_000).runners[0]).toEqual(raceSnapshot(race, START + 5_000).runners[0]);
  });
  it("keeps a disconnected runner active, resumes input, and expires only while disconnected", () => {
    const race = input(racing(), ["a"]);
    const disconnected = setRunnerConnected(race, "host", false, START + 2_000);
    const waiting = abandonRace(disconnected, "guest", START + 3_000);
    expect(waiting.status).toBe("racing");
    const connected = setRunnerConnected(waiting, "host", true, START + 4_000);
    expect(expireRunner(connected, "host", START + 5_000).runners[0].status).toBe("typing");
    expect(input(connected, ["b", "c"], START + 5_000).status).toBe("results");
    const expired = expireRunner(waiting, "host", START + 32_000);
    expect(expired).toMatchObject({ status: "results", endedAt: START + 32_000 });
    expect(expired.runners[0]).toMatchObject({ status: "abandoned", position: 1 });
    expect(race.runners[0].connected).toBe(true);
  });
  it("ends exactly at the deadline even when the first tick is late", () => {
    const race = started();
    const final = tickRace(race, START + race.timeLimitMs + 9_000);
    expect(final).toMatchObject({ status: "results", endedAt: START + race.timeLimitMs });
    expect(raceResults(final)?.every((r) => r.status === "unfinished" && r.timeMs === race.timeLimitMs)).toBe(true);
  });
  it("updates bot progression and finishes at the planned time, bounded by the deadline", () => {
    const source = room();
    source.config.botCount = 1;
    const race = started(source);
    const bot = race.runners[2];
    if (!bot.plan) throw new Error("Missing bot plan");
    const now = START + 5_000;
    const next = tickRace(race, now);
    expect(next.runners[2].position).toBe(botProgressAt(bot.plan, 5_000));
    expect(next.runners[2].keystrokes).toEqual(botKeystrokesAt(bot.plan, 5_000));
    const finish = START + botFinishMs(bot.plan);
    const abandoned = abandonRace(abandonRace(race, "host", START), "guest", START);
    const final = tickRace(abandoned, finish + 9_000);
    expect(final).toMatchObject({ status: "results", endedAt: finish });
    expect(final.runners[2]).toMatchObject({ status: "finished", finishedAt: finish });
    const limited = tickRace({ ...race, timeLimitMs: 1_000 }, START + 99_000);
    expect(limited.runners[2].position).toBe(botProgressAt(bot.plan, 1_000));
    expect(limited.runners[2].finishedAt).toBeNull();
    expect(race.runners[2].position).toBe(0);
  });
});

describe("snapshots and COURSE-10 results", () => {
  it("computes Annex A metrics including spaces, gross WPM and corrected errors without exposing input", () => {
    const race = racing("a b");
    const final = abandonRace(input(race, ["x", "\b", "a", " "], START + 60_000), "host", START + 60_000);
    const snapshot = raceSnapshot(final, START + 90_000).runners[0];
    expect(snapshot).toMatchObject({ position: 2, progress: 2 / 3, wpm: 0, accuracy: 67 });
    expect(snapshot).not.toHaveProperty("typed");
    expect(snapshot).not.toHaveProperty("plan");
    expect(raceResults(race)).toBeNull();
    const ended = tickRace(final, START + race.timeLimitMs);
    expect(raceResults(ended)?.find((r) => r.id === "host")).toMatchObject({
      wpm: 0, grossWpm: 1, accuracy: 67, errors: 1, timeMs: 60_000, status: "abandoned",
    });
    // Débits exacts : 25 caractères validés / 5 / 0,5 min = 10 nets ; 30 frappes = 12 bruts.
    const measured: RaceState = { ...ended, text: "a".repeat(50), runners: [{ ...ended.runners[0],
      position: 25, keystrokes: { total: 30, correct: 27 }, abandonedAt: START + 30_000 }] };
    expect(raceResults(measured)?.[0]).toMatchObject({ wpm: 10, grossWpm: 12, accuracy: 90, errors: 3, progress: 0.5 });
  });
  it("orders arrivals by time, unfinished then abandoned by frozen progress, with stable ties", () => {
    const race = racing("a".repeat(100));
    const base = race.runners[0];
    const final: RaceState = { ...race, status: "results", endedAt: START + 60_000, runners: [
      { ...base, id: "abandoned-low", status: "abandoned", position: 10, abandonedAt: START + 20_000 },
      { ...base, id: "late", status: "finished", position: 100, finishedAt: START + 40_000 },
      { ...base, id: "unfinished-low", position: 5 },
      { ...base, id: "early", status: "finished", position: 100, finishedAt: START + 30_000 },
      { ...base, id: "abandoned-high", status: "abandoned", position: 90, abandonedAt: START + 10_000 },
      { ...base, id: "unfinished-high", position: 50 },
      { ...base, id: "tied", position: 50 },
    ] };
    const before = structuredClone(final);
    expect(raceResults(final)?.map((r) => [r.id, r.rank])).toEqual([
      ["early", 1], ["late", 2], ["unfinished-high", 3], ["tied", 4],
      ["unfinished-low", 5], ["abandoned-high", 6], ["abandoned-low", 7],
    ]);
    expect(final).toEqual(before);
  });
});

it("exposes the server clock with the scheduled start for synchronized countdowns", () => {
  expect(raceSnapshot(started(), NOW + 500)).toMatchObject({
    serverNow: NOW + 500, startAt: START, status: "countdown",
  });
});

describe("série MPM (RES-05)", () => {
  it("complète chaque seconde malgré les ticks irréguliers et fige la série à l’arrivée", () => {
    let race = input(racing(), ["a"], START + 500);
    race = tickRace(race, START + 3_400);
    expect(race.runners[0].wpmSeries).toEqual([0, 12, 6, 4]);
    expect(raceSnapshot(race, START + 3_400).runners[0]).not.toHaveProperty("wpmSeries");
    race = input(race, ["b", "c"], START + 3_500);
    const series = [...race.runners[0].wpmSeries];
    expect(tickRace(race, START + 9_000).runners[0].wpmSeries).toEqual(series);
  });

  it("fige à l’abandon et borne les séries à la limite de temps et à 600 valeurs", () => {
    const race = abandonRace(racing(), "host", START + 1_500);
    expect(tickRace(race, START + 9_000).runners[0].wpmSeries).toEqual([0, 0]);
    const limited = { ...racing(), timeLimitMs: 600_000 };
    expect(tickRace(limited, START + 900_000).runners[1].wpmSeries).toHaveLength(600);
    const short = { ...racing(), timeLimitMs: 2_000 };
    expect(tickRace(short, START + 900_000).runners[1].wpmSeries).toHaveLength(2);
  });
});
