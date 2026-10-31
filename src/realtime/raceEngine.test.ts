import { describe, expect, it } from "vitest";
import { applyTextEdits } from "@/race/bonuses";
import { botFinishMs, botKeystrokesAt, botProgressAt, planBot } from "@/race/bots";
import { createSeededRandom, shuffled } from "@/race/seededRandom";
import { generateRaceText } from "@/race/textGenerator";
import fr from "@/i18n/dictionaries/fr.json";
import { COUNTDOWN_MS } from "@/race/lifecycle";
import { BOT_LEVELS, DEFAULT_ROOM_CONFIG, INPUT_MODES, type RoomState } from "./protocol";
import {
  abandonRace, applyInput, expireRunner, raceResults, raceResultRows, raceSnapshot,
  setRunnerConnected, startRace, tickRace, type RaceState,
} from "./raceEngine";

const NOW = 1_000;
const START = NOW + COUNTDOWN_MS;
function room(): RoomState {
  return {
    code: "ABCDEF", status: "waiting", hostId: "host",
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
    spectators.config.bots = ["intermediate", "intermediate"];
    expect(startRace(spectators, "host", NOW, 42)).toEqual({ ok: false, error: "NOT_ENOUGH_RUNNERS" });
  });
  it("allows a spectator host with two runners", () => {
    const source = room();
    source.participants[0].role = "spectator";
    source.config.bots = ["intermediate"];
    expect(started(source).runners.map((r) => r.id)).toEqual(["guest", "bot-0"]);
  });
  it("allows one human and one bot, revealing deterministic text and plans at countdown", () => {
    const source = room();
    source.participants.pop();
    source.config.bots = ["intermediate"];
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
  it.each(INPUT_MODES)("creates one plan per configured level and exposes levels (%s)", (inputMode) => {
    const source = room();
    source.config = { ...source.config, inputMode, bots: [...BOT_LEVELS] };
    const race = started(source);
    const random = createSeededRandom(42);
    generateRaceText(source.config, random);
    shuffled(fr.raceScreen.botNames, random);
    const bots = race.runners.filter((runner) => runner.kind === "bot");
    expect(bots).toHaveLength(BOT_LEVELS.length);
    BOT_LEVELS.forEach((level, index) => {
      expect(bots[index]).toMatchObject({ id: `bot-${index}`, level, plan: planBot(race.text, level, inputMode, random) });
    });
    expect(raceSnapshot(race, NOW).runners.filter((runner) => runner.kind === "bot").map((runner) => runner.level)).toEqual(BOT_LEVELS);
    const finished = tickRace(race, START + race.timeLimitMs);
    expect(raceResults(finished)?.filter((row) => row.kind === "bot").map((row) => row.level).sort()).toEqual([...BOT_LEVELS].sort());
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
    source.config.bots = ["intermediate"];
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
  it.each(INPUT_MODES)("updates bot progression and finishes at the planned time, bounded by the deadline (%s)", (inputMode) => {
    const source = room();
    source.config.bots = ["intermediate"];
    source.config.inputMode = inputMode;
    const race = started(source);
    const bot = race.runners[2];
    if (!bot.plan) throw new Error("Missing bot plan");
    expect(bot.plan.mistakeTimesMs.length).toBeGreaterThan(0);
    expect(bot.plan.extraCorrectTimesMs.length > 0).toBe(inputMode === "free");
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

describe("séries des bots aux résultats (RES-03)", () => {
  // Un plan accélérant rend les points vérifiables, y compris le MPM à l'arrivée.
  it("échantillonne jusqu’à la fin du bot, indépendamment de la fin de course", () => {
    const source = room();
    source.config.bots = ["intermediate"];
    const race = racing("a".repeat(80), source);
    race.runners[2].plan = {
      textLength: 80,
      keyframes: [0, 5, 20, 45, 80].map((chars, second) => ({ chars, timeMs: second * 1000 })),
      mistakeTimesMs: [], extraCorrectTimesMs: [],
    };
    const ended = tickRace(race, START + race.timeLimitMs);
    const bot = raceResults(ended)?.find((row) => row.kind === "bot");
    expect(bot?.wpmSeries).toEqual([0, 60, 120, 180, 240]);
    expect(bot?.wpmSeries.at(-1)).toBe(bot?.wpm);
    expect(bot?.timeMs).toBe(4000);
    expect(raceResults(ended)?.[0].wpmSeries).toHaveLength(5);
    expect(raceResults(ended)?.find((row) => row.id === "host")?.wpmSeries).toEqual(ended.runners[0].wpmSeries);
    expect(raceSnapshot(ended, START + race.timeLimitMs).runners[2]).not.toHaveProperty("wpmSeries");
  });

  it("arrête un bot non arrivé à la limite et borne sa série à 601 points", () => {
    const source = room();
    source.config.bots = ["beginner"];
    const race = racing("a".repeat(1000), source);
    race.runners[2].plan = {
      textLength: 1000, keyframes: [{ chars: 0, timeMs: 0 }, { chars: 1000, timeMs: 1_000_000 }],
      mistakeTimesMs: [], extraCorrectTimesMs: [],
    };
    for (const limit of [2500, 600_000]) {
      const ended = tickRace({ ...race, timeLimitMs: limit }, START + limit + 10_000);
      const bot = raceResults(ended)?.find((row) => row.kind === "bot");
      expect(bot?.wpmSeries).toHaveLength(Math.floor(limit / 1000) + 1);
      expect(bot?.status).toBe("unfinished");
      expect(bot?.wpmSeries.at(-1)).toBe(12);
      expect(bot?.wpm).toBe(limit === 2500 ? 10 : 12);
    }
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

  it("fige à l’abandon et inclut la dernière seconde à la limite de temps, au plus 601 valeurs", () => {
    const race = abandonRace(racing(), "host", START + 1_500);
    expect(tickRace(race, START + 9_000).runners[0].wpmSeries).toEqual([0, 0]);
    const limited = { ...racing(), timeLimitMs: 600_000 };
    expect(tickRace(limited, START + 900_000).runners[1].wpmSeries).toHaveLength(601);
    const short = { ...racing(), timeLimitMs: 2_000 };
    expect(tickRace(short, START + 2_000).runners[1].wpmSeries).toEqual([0, 0, 0]);
    expect(tickRace(short, START + 900_000).runners[1].wpmSeries).toHaveLength(3);
  });
});

describe("bonus de remontée faisant autorité", () => {
  const text = "un deux trois quatre cinq six sept huit";
  function checkpointRace(seed: number, bonuses = true): RaceState {
    const source = room();
    source.config.bonuses = bonuses;
    const race = racing(text, source);
    return { ...race, seed, runners: race.runners.map((r, i) => i === 0
      ? { ...r, typed: text.slice(0, 12), position: 12 } : r) };
  }

  // Sans activation, les points franchis ne changent ni le texte ni les adversaires.
  it("keeps bonuses disabled by default even after crossing all checkpoints", () => {
    const race = checkpointRace(3, false);
    race.runners[0].position = text.length - 1;
    const next = tickRace(race, START + 1_000);
    expect(next.checkpointsTriggered).toBe(0);
    expect(next.bonusEvents).toEqual([]);
    expect(next.runners.every((r) => r.edits.length === 0 && r.bonusesReceived === 0 && r.fogUntil === null)).toBe(true);
  });

  it("does not consume a checkpoint crossed only by an abandoned runner", () => {
    const race = checkpointRace(3);
    race.text = "a".repeat(100);
    race.checkpointsTriggered = 1;
    race.runners[0] = { ...race.runners[0], position: 60, status: "abandoned", abandonedAt: START + 1_000 };
    race.runners[1] = { ...race.runners[1], position: 10 };
    const next = tickRace(race, START + 1_000);
    expect(next.checkpointsTriggered).toBe(1);
    expect(next.bonusEvents).toEqual([]);
    next.runners[1] = { ...next.runners[1], position: 51 };
    expect(tickRace(next, START + 2_000).checkpointsTriggered).toBe(2);
  });

  // Le raccourcissement doit être utilisable à la frappe et préserver la MPM réelle.
  it("awards the trailing runner once, accepts their shortened text and finishes it", () => {
    const race = checkpointRace(3);
    const before = structuredClone(race);
    let next = tickRace(race, START + 1_000);
    expect(next.bonusEvents).toMatchObject([{ checkpoint: 0, recipientId: "guest", targetId: "guest", type: "shorten", at: START + 1_000 }]);
    expect(next.runners[0].edits).toEqual([]);
    expect(next.runners[1].bonusesReceived).toBe(1);
    const shorter = applyTextEdits(text, next.runners[1].edits);
    expect(shorter).toBe("un cinq six sept huit");
    expect(tickRace(next, START + 1_000).bonusEvents).toEqual(next.bonusEvents);
    next = input(next, shorter.split(""), START + 2_000, "guest");
    expect(next.runners[1]).toMatchObject({ status: "finished", position: shorter.length, finishedAt: START + 2_000 });
    const snapshot = raceSnapshot(next, START + 2_000).runners[1];
    expect(snapshot).toMatchObject({ progress: 1, textLength: shorter.length, edits: next.runners[1].edits, fogUntil: null });
    next = abandonRace(next, "host", START + 20_000);
    expect(raceSnapshot(next, START + 20_000).bonusEvents).toEqual([]);
    expect(raceResults(next)?.[0]).toMatchObject({ id: "guest", progress: 1, bonusesReceived: 1, bonusTypes: ["shorten"], wpm: Math.round(shorter.length / 5 / (2 / 60)) });
    expect(race).toEqual(before);
  });

  // Un malus ajoute exactement trois mots conformes, sans faire crédit de frappes au meneur.
  it("adds three configured words to the leader and uses each runner's length in results", () => {
    const race = checkpointRace(0);
    race.config = { ...race.config, language: "en", accents: false, uppercase: false, punctuation: false, excludedCharacters: "z" };
    const next = tickRace(race, START + 1_000);
    expect(next.bonusEvents).toMatchObject([{ recipientId: "guest", targetId: "host", type: "lengthen" }]);
    const longer = applyTextEdits(text, next.runners[0].edits);
    const added = longer.slice(text.length + 1);
    expect(added.split(" ")).toHaveLength(3);
    expect(added).toMatch(/^[a-y ]+$/u);
    expect(next.runners[0].position).toBe(12);
    expect(next.runners[0].bonusesReceived).toBe(0);
    const final = { ...next, endedAt: START + 60_000 };
    expect(raceResults(final)?.find((r) => r.id === "host")?.progress).toBe(12 / longer.length);
    const ranked = { ...final, runners: final.runners.map((r, i) => ({ ...r, position: i === 0 ? 12 : 11 })) };
    expect(raceResults(ranked)?.[0].id).toBe("guest");
    expect(raceResults(final)?.find((r) => r.id === "guest")).toMatchObject({ bonusesReceived: 1, bonusTypes: ["lengthen"] });
  });

  // Le brouillard humain n'a aucun effet serveur sur la cadence autorisée ou la validation.
  it("lets a fogged human type normally until finishing", () => {
    const next = tickRace(checkpointRace(1), START + 1_000);
    expect(next.runners[0].fogUntil).toBe(START + 5_000);
    const finished = input(next, text.slice(12).split(""), START + 2_000);
    expect(finished.runners[0].status).toBe("finished");
  });

  // Le plafond et le rejeu empêchent les doubles attributions lors de ticks répétés.
  it("is deterministic for the same seed and caps received bonuses at three", () => {
    const run = () => {
      const race = checkpointRace(0);
      race.runners[0].position = text.length - 1;
      return tickRace(race, START + 1_000);
    };
    const next = run();
    expect(run()).toEqual(next);
    expect(next.checkpointsTriggered).toBe(3);
    expect(next.runners[1].bonusesReceived).toBe(3);
    expect(tickRace(next, START + 2_000).bonusEvents).toEqual(next.bonusEvents);
    const capped = checkpointRace(0);
    capped.runners[1].bonusesReceived = 3;
    expect(tickRace(capped, START + 1_000).bonusEvents).toEqual([]);
  });

  // Les trois effets recalculent le futur du bot et lui permettent de finir son texte propre.
  it.each(["shorten", "lengthen", "fog"] as const)("replans a bot affected by %s and finishes its current text", (type) => {
    const source = room();
    source.participants.pop();
    source.config = { ...source.config, bonuses: true, bots: ["impossible"] };
    let race = started(source);
    const bot = race.runners[1];
    if (!bot.plan) throw new Error("Missing bot plan");
    let now = START + 100;
    if (type === "shorten") {
      race = { ...race, seed: 3, runners: [{ ...race.runners[0], position: Math.ceil(race.text.length * 0.3) }, bot] };
    } else {
      race = { ...race, seed: type === "lengthen" ? 0 : 1 };
      const frame = bot.plan.keyframes.find((f) => f.chars > race.text.length * 0.3);
      if (!frame) throw new Error("Missing checkpoint frame");
      now = START + Math.ceil(frame.timeMs);
    }
    race = tickRace(race, now);
    expect(race.bonusEvents[0]).toMatchObject({ type, targetId: "bot-0" });
    expect(race.runners[1].plan).not.toEqual(bot.plan);
    const plan = race.runners[1].plan;
    if (!plan) throw new Error("Missing updated plan");
    expect(plan.textLength).toBe(applyTextEdits(race.text, race.runners[1].edits).length);
    if (type === "fog") expect(botFinishMs(plan)).toBeGreaterThan(botFinishMs(bot.plan));
    race = abandonRace(race, "host", now);
    const finish = START + botFinishMs(plan);
    const final = tickRace(race, finish);
    expect(final.runners[1]).toMatchObject({ status: "finished", position: plan.textLength, finishedAt: finish });
    expect(raceResults(final)?.find((r) => r.kind === "bot")?.progress).toBe(1);
    if (type === "shorten") expect(final.runners[1].bonusesReceived).toBe(1);
  });
});

// Protège le comptage serveur et la taille du snapshot diffusé en course.
it("exposes expected missed keys only in human results and persistence rows", () => {
  const source = room();
  source.config.bots = ["beginner"];
  const race = input(racing("abc", source), ["x", "\b", "a", "b", "c"]);
  const ended = tickRace(race, START + race.timeLimitMs);
  expect(raceResults(ended)?.find((row) => row.id === "host")?.missedKeys).toEqual({ a: 1 });
  expect(raceResultRows(ended).find((row) => row.userId === "host")?.missedKeys).toEqual({ a: 1 });
  expect(raceResults(ended)?.find((row) => row.kind === "bot")).not.toHaveProperty("missedKeys");
  for (const runner of raceSnapshot(race, START + 1_000).runners) {
    expect(runner).not.toHaveProperty("missedKeys");
  }
});
