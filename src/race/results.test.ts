import { describe, expect, it } from "vitest";
import { botFinishMs, planBot, type BotPlan } from "./bots";
import { buildRaceResults, type BotEntry, type PlayerOutcome } from "./results";

/** Bot qui tape à vitesse constante, sans pause ni faute. */
function steadyPlan(textLength: number, charsPerSecond: number, mistakeTimesMs: readonly number[] = []): BotPlan {
  return {
    textLength,
    keyframes: [
      { timeMs: 0, chars: 0 },
      { timeMs: (textLength / charsPerSecond) * 1000, chars: textLength },
    ],
    mistakeTimesMs,
  };
}

const TEXT_LENGTH = 100;
const bot = (id: string, charsPerSecond: number): BotEntry => ({ id, name: id, plan: steadyPlan(TEXT_LENGTH, charsPerSecond) });
const outcome = (overrides: Partial<PlayerOutcome>): PlayerOutcome => ({
  reason: "completed",
  elapsedMs: 20_000,
  correctChars: TEXT_LENGTH,
  keystrokes: { total: 11, correct: 10 },
  ...overrides,
});
const build = (player: PlayerOutcome, bots: BotEntry[]) =>
  buildRaceResults({ textLength: TEXT_LENGTH, playerId: "player", playerName: "Toi", player, bots });

describe("classement final (A-D7, RES-1, RES-2)", () => {
  it("classe les arrivés par temps, bots plus rapides ou plus lents que le joueur", () => {
    const rows = build(outcome({}), [bot("fast", 10), bot("slow", 2)]);
    expect(rows.map((row) => [row.id, row.rank, row.status])).toEqual([
      ["fast", 1, "finished"],
      ["player", 2, "finished"],
      ["slow", 3, "unfinished"],
    ]);
    expect(rows[0]).toMatchObject({ timeMs: 10_000, wpm: 120, accuracy: 100 });
    expect(rows[1]).toMatchObject({ timeMs: 20_000, wpm: 60, accuracy: 91 });
  });

  it("un bot non arrivé est classé selon sa progression à la fin, avec son MPM sur ce temps", () => {
    const rows = build(outcome({}), [bot("a", 2), bot("b", 4)]);
    expect(rows.map((row) => row.id)).toEqual(["player", "b", "a"]);
    expect(rows[1]).toMatchObject({ status: "unfinished", correctChars: 80, timeMs: 20_000, wpm: 48 });
    expect(rows[2]).toMatchObject({ correctChars: 40 });
  });

  it("temps écoulé : le joueur est classé par ses caractères corrects parmi les non arrivés", () => {
    const rows = build(outcome({ reason: "timeout", elapsedMs: 10_000, correctChars: 50 }), [bot("ahead", 8), bot("behind", 2)]);
    expect(rows.map((row) => row.id)).toEqual(["ahead", "player", "behind"]);
    expect(rows[1].status).toBe("unfinished");
  });

  it("un abandon est classé dernier et marqué, même avec plus de caractères que les bots", () => {
    const rows = build(outcome({ reason: "abandoned", elapsedMs: 10_000, correctChars: 90 }), [bot("slow", 1)]);
    expect(rows.map((row) => [row.id, row.rank, row.status])).toEqual([
      ["slow", 1, "unfinished"],
      ["player", 2, "abandoned"],
    ]);
  });

  it("calcule la précision d'un bot avec ses fautes déjà commises, comme celle du joueur", () => {
    const sloppy: BotEntry = { id: "sloppy", name: "sloppy", plan: steadyPlan(TEXT_LENGTH, 10, [2_000, 4_000, 20_000]) };
    // Fini à 10 s : 3 fautes prévues, mais seules 2 ont eu lieu -> 100 / 102.
    expect(build(outcome({}), [sloppy]).find((row) => row.id === "sloppy")?.accuracy).toBe(98);
    // Le joueur finit à 3 s : le bot n'a commis qu'une faute, sur 30 caractères corrects.
    const early = build(outcome({ elapsedMs: 3_000 }), [sloppy]).find((row) => row.id === "sloppy");
    expect(early).toMatchObject({ status: "unfinished", accuracy: 97 });
  });

  it("à égalité de temps le joueur passe devant, et les rangs sont consécutifs", () => {
    const rows = build(outcome({}), [bot("tie", 5), bot("other", 5)]);
    expect(rows.map((row) => row.id)).toEqual(["player", "tie", "other"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("fonctionne sans bot et avec de vrais plans", () => {
    expect(build(outcome({}), []).map((row) => row.rank)).toEqual([1]);
    const text = "le petit chat dort sur le canapé du salon";
    const plan = planBot(text, "normal", () => 0.5);
    const rows = buildRaceResults({
      textLength: text.length,
      playerId: "player",
      playerName: "Toi",
      player: outcome({ elapsedMs: botFinishMs(plan) + 1, correctChars: text.length }),
      bots: [{ id: "bot", name: "Bot", plan }],
    });
    expect(rows[0].id).toBe("bot");
  });
});
