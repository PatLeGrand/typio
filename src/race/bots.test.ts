import { describe, expect, it } from "vitest";
import {
  BOT_TARGET_WPM,
  botFinishMs,
  botKeystrokesAt,
  botProgressAt,
  planBot,
  type BotDifficulty,
} from "./bots";
import { generateRaceText } from "./textGenerator";

/** Générateur à graine (mulberry32) : même graine, même suite. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mediumText(seed: number): string {
  const result = generateRaceText(
    { textMode: "sentences", language: "fr", accents: true, length: "medium", excludedCharacters: "" },
    seeded(seed),
  );
  if (!result.ok) throw new Error("texte indisponible");
  return result.text;
}

const TEXT = mediumText(1);
const DIFFICULTIES: BotDifficulty[] = ["easy", "normal", "hard"];

/** MPM moyenne d'un bot sur toute la course : (caractères / 5) / minutes. */
function averageWpm(textLength: number, finishMs: number): number {
  return textLength / 5 / (finishMs / 60_000);
}

describe("BOT_TARGET_WPM", () => {
  it("fixe 25, 40 et 60 MPM (A-D8)", () => {
    expect(BOT_TARGET_WPM).toEqual({ easy: 25, normal: 40, hard: 60 });
  });
});

describe("planBot / botProgressAt / botFinishMs", () => {
  it("part de 0 et atteint la longueur du texte à la fin", () => {
    for (const difficulty of DIFFICULTIES) {
      const plan = planBot(TEXT, difficulty, seeded(9));
      expect(botProgressAt(plan, 0)).toBe(0);
      expect(botProgressAt(plan, -50)).toBe(0);
      expect(botProgressAt(plan, botFinishMs(plan))).toBe(TEXT.length);
      expect(botProgressAt(plan, botFinishMs(plan) + 10_000)).toBe(TEXT.length);
      expect(botProgressAt(plan, botFinishMs(plan) - 1)).toBeLessThanOrEqual(TEXT.length);
    }
  });

  it("progresse de façon croissante au sens large, en entiers, sans dépasser le texte", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planBot(TEXT, difficulty, seeded(seed));
        const finish = botFinishMs(plan);
        let previous = 0;
        for (let t = 0; t <= finish + 100; t += 37) {
          const progress = botProgressAt(plan, t);
          expect(Number.isInteger(progress)).toBe(true);
          expect(progress).toBeGreaterThanOrEqual(previous);
          expect(progress).toBeLessThanOrEqual(TEXT.length);
          previous = progress;
        }
        expect(previous).toBe(TEXT.length);
      }
    }
  });

  it("est déterministe : même graine, même courbe", () => {
    const a = planBot(TEXT, "normal", seeded(5));
    const b = planBot(TEXT, "normal", seeded(5));
    expect(botFinishMs(a)).toBe(botFinishMs(b));
    expect(botProgressAt(a, 4_321)).toBe(botProgressAt(b, 4_321));
  });

  it("tient la vitesse cible à ±15 % sur un texte moyen, pour chaque difficulté", () => {
    for (const difficulty of DIFFICULTIES) {
      const target = BOT_TARGET_WPM[difficulty];
      let total = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const text = mediumText(seed);
        const wpm = averageWpm(text.length, botFinishMs(planBot(text, difficulty, seeded(seed))));
        expect(wpm).toBeGreaterThanOrEqual(target * 0.85);
        expect(wpm).toBeLessThanOrEqual(target * 1.15);
        total += wpm;
      }
      expect(Math.abs(total / 50 - target) / target).toBeLessThan(0.08);
    }
  });

  it("marque des pauses : la progression reste parfois à l'arrêt", () => {
    let stalled = false;
    for (let seed = 1; seed <= 20 && !stalled; seed++) {
      const plan = planBot(TEXT, "hard", seeded(seed));
      for (let t = 0; t < botFinishMs(plan) && !stalled; t += 50) {
        // 250 ms sans nouveau caractère à 60 MPM (soit 5 car/s) trahit une pause ou une faute.
        if (botProgressAt(plan, t) === botProgressAt(plan, t + 250)) stalled = true;
      }
    }
    expect(stalled).toBe(true);
  });

  it("un bot difficile bat un bot facile dans plus de 90 % des cas sur 100 graines (AC-7)", () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const text = mediumText(seed);
      const hard = botFinishMs(planBot(text, "hard", seeded(seed)));
      const easy = botFinishMs(planBot(text, "easy", seeded(seed + 1000)));
      if (hard < easy) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(90);
  });

  it("deux bots de même difficulté avec des graines différentes ne finissent pas au même ms (AC-7)", () => {
    for (const difficulty of DIFFICULTIES) {
      const finishes = new Set<number>();
      for (let seed = 1; seed <= 30; seed++) {
        finishes.add(botFinishMs(planBot(TEXT, difficulty, seeded(seed))));
      }
      expect(finishes.size).toBe(30);
    }
  });

  it("gère un texte vide et un texte d'un seul mot", () => {
    const empty = planBot("", "normal", seeded(1));
    expect(botFinishMs(empty)).toBe(0);
    expect(botProgressAt(empty, 0)).toBe(0);
    expect(botProgressAt(empty, 1_000)).toBe(0);

    const single = planBot("bonjour", "hard", seeded(1));
    expect(botFinishMs(single)).toBeGreaterThan(0);
    expect(botProgressAt(single, botFinishMs(single))).toBe(7);
  });

  it("liste les fautes du plan, croissantes et dans la durée de la course", () => {
    const plan = planBot(TEXT, "hard", seeded(5));
    expect(plan.mistakeTimesMs).toEqual([...plan.mistakeTimesMs].sort((a, b) => a - b));
    for (const timeMs of plan.mistakeTimesMs) expect(timeMs).toBeLessThanOrEqual(botFinishMs(plan));
    expect(planBot("", "normal", seeded(1)).mistakeTimesMs).toEqual([]);
  });
});

describe("botKeystrokesAt", () => {
  it("compte une frappe fausse par faute commise, comme la précision du joueur", () => {
    let withMistakes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planBot(TEXT, "normal", seeded(seed));
      const end = botFinishMs(plan);
      const { total, correct } = botKeystrokesAt(plan, end);
      expect(correct).toBe(TEXT.length);
      expect(total).toBe(TEXT.length + plan.mistakeTimesMs.length);
      expect(botKeystrokesAt(plan, 0)).toEqual({ total: 0, correct: 0 });
      if (plan.mistakeTimesMs.length > 0) {
        withMistakes += 1;
        const first = plan.mistakeTimesMs[0];
        expect(botKeystrokesAt(plan, first - 1).total - botKeystrokesAt(plan, first - 1).correct).toBe(0);
        const after = botKeystrokesAt(plan, first);
        expect(after.total - after.correct).toBeGreaterThanOrEqual(1);
      }
    }
    expect(withMistakes).toBeGreaterThan(0);
  });
});
