import { describe, expect, it } from "vitest";
import {
  BOT_LEVEL_PROFILES,
  botFinishMs,
  botKeystrokesAt,
  botProgressAt,
  planBot,
} from "./bots";
import { BOT_LEVELS, INPUT_MODES } from "../realtime/protocol";
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
    {
      textMode: "sentences",
      language: "fr",
      accents: true,
      length: "medium",
      excludedCharacters: "",
      complexity: "medium",
      punctuation: true,
      numbers: false,
      uppercase: true,
    },
    seeded(seed),
  );
  if (!result.ok) throw new Error("texte indisponible");
  return result.text;
}

const TEXT = mediumText(1);
const DIFFICULTIES = BOT_LEVELS;

/** MPM moyenne d'un bot sur toute la course : (caractères / 5) / minutes. */
function averageWpm(textLength: number, finishMs: number): number {
  return textLength / 5 / (finishMs / 60_000);
}

describe("planBot / botProgressAt / botFinishMs", () => {
  it.each(INPUT_MODES)("part de 0 et atteint la longueur du texte à la fin (%s)", (mode) => {
    for (const difficulty of DIFFICULTIES) {
      const plan = planBot(TEXT, difficulty, mode, seeded(9));
      expect(botProgressAt(plan, 0)).toBe(0);
      expect(botProgressAt(plan, -50)).toBe(0);
      expect(botProgressAt(plan, botFinishMs(plan))).toBe(TEXT.length);
      expect(botProgressAt(plan, botFinishMs(plan) + 10_000)).toBe(TEXT.length);
      expect(botProgressAt(plan, botFinishMs(plan) - 1)).toBeLessThanOrEqual(TEXT.length);
    }
  });

  it.each(INPUT_MODES)("progresse en entiers sans reculer ni dépasser le texte (%s)", (mode) => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed <= 20; seed++) {
        const plan = planBot(TEXT, difficulty, mode, seeded(seed));
        const finish = botFinishMs(plan);
        let previous = 0;
        const times = [...Array.from({ length: 301 }, (_, index) => finish * index / 300),
          ...plan.keyframes.map((frame) => frame.timeMs), finish + 100].sort((a, b) => a - b);
        for (const t of times) {
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

  it.each(INPUT_MODES)("est déterministe : même graine, même courbe (%s)", (mode) => {
    const a = planBot(TEXT, "intermediate", mode, seeded(5));
    const b = planBot(TEXT, "intermediate", mode, seeded(5));
    expect(a).toEqual(b);
    expect(botProgressAt(a, 4_321)).toBe(botProgressAt(b, 4_321));
  });

  it("calibre la MPM nette et la précision moyennes de chaque niveau dans les deux modes", () => {
    for (const difficulty of DIFFICULTIES) {
      const profile = BOT_LEVEL_PROFILES[difficulty];
      for (const mode of INPUT_MODES) {
        let totalWpm = 0;
        let totalAccuracy = 0;
        for (let seed = 1; seed <= 50; seed++) {
          const text = mediumText(seed).slice(0, 300);
          const plan = planBot(text, difficulty, mode, seeded(seed));
          const finish = botFinishMs(plan);
          const strokes = botKeystrokesAt(plan, finish);
          const wpm = averageWpm(text.length, finish);
          expect(wpm).toBeGreaterThanOrEqual(profile.minWpm * 0.85);
          expect(wpm).toBeLessThanOrEqual(profile.maxWpm * 1.15);
          totalWpm += wpm;
          totalAccuracy += strokes.correct / strokes.total;
        }
        expect(totalWpm / 50).toBeGreaterThanOrEqual(profile.minWpm);
        expect(totalWpm / 50).toBeLessThanOrEqual(profile.maxWpm);
        expect(Math.abs(totalAccuracy / 50 - (1 - profile.errorRate))).toBeLessThan(0.025);
      }
    }
  });

  it("ralentit les mots difficiles de même longueur avec les mêmes tirages", () => {
    const simple = botFinishMs(planBot("abcdef", "expert", "blocking", () => 0.5));
    for (const word of ["Abcdef", "abcd1f", "abcde!", "abcdeé"]) {
      expect(botFinishMs(planBot(word, "expert", "blocking", () => 0.5))).toBeGreaterThan(simple);
    }
  });

  it("marque des pauses : la progression reste parfois à l'arrêt", () => {
    let stalled = false;
    for (let seed = 1; seed <= 20 && !stalled; seed++) {
      const plan = planBot(TEXT, "expert", "blocking", seeded(seed));
      for (let t = 0; t < botFinishMs(plan) && !stalled; t += 50) {
        // 250 ms sans nouveau caractère au niveau expert trahit une pause ou une faute.
        if (botProgressAt(plan, t) === botProgressAt(plan, t + 250)) stalled = true;
      }
    }
    expect(stalled).toBe(true);
  });

  it("un bot difficile bat un bot facile dans plus de 90 % des cas sur 100 graines (AC-7)", () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const text = mediumText(seed);
      const hard = botFinishMs(planBot(text, "expert", "blocking", seeded(seed)));
      const easy = botFinishMs(planBot(text, "beginner", "blocking", seeded(seed + 1000)));
      if (hard < easy) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(90);
  });

  it("deux bots de même difficulté avec des graines différentes ne finissent pas au même ms (AC-7)", () => {
    for (const difficulty of DIFFICULTIES) {
      const finishes = new Set<number>();
      for (let seed = 1; seed <= 30; seed++) {
        finishes.add(botFinishMs(planBot(TEXT, difficulty, "blocking", seeded(seed))));
      }
      expect(finishes.size).toBe(30);
    }
  });

  it("gère un texte vide et un texte d'un seul mot", () => {
    const empty = planBot("", "intermediate", "blocking", seeded(1));
    expect(botFinishMs(empty)).toBe(0);
    expect(botProgressAt(empty, 0)).toBe(0);
    expect(botProgressAt(empty, 1_000)).toBe(0);

    const single = planBot("bonjour", "expert", "blocking", seeded(1));
    expect(botFinishMs(single)).toBeGreaterThan(0);
    expect(botProgressAt(single, botFinishMs(single))).toBe(7);
  });

  it("liste les fautes du plan, croissantes et dans la durée de la course", () => {
    const plan = planBot(TEXT, "expert", "blocking", seeded(5));
    expect(plan.mistakeTimesMs).toEqual([...plan.mistakeTimesMs].sort((a, b) => a - b));
    for (const timeMs of plan.mistakeTimesMs) expect(timeMs).toBeLessThanOrEqual(botFinishMs(plan));
    expect(planBot("", "intermediate", "blocking", seeded(1)).mistakeTimesMs).toEqual([]);
  });
});

describe("botKeystrokesAt", () => {
  it.each(INPUT_MODES)("corrige une faute sans valider les caractères suivants (%s)", (mode) => {
    // Première faute imposée, puis deux caractères anticipés en mode libre, sans autre faute.
    const draws = [0.5, 0.5, 0.5, 0.5, 0, 0.9];
    const plan = planBot("abcde", "noob", mode, () => draws.shift() ?? 0.5);
    expect(plan.mistakeTimesMs).toHaveLength(1);
    const mistake = plan.mistakeTimesMs[0];
    expect(botProgressAt(plan, mistake)).toBe(0);
    expect(botKeystrokesAt(plan, mistake)).toEqual({ total: 1, correct: 0 });
    if (mode === "free") {
      expect(plan.extraCorrectTimesMs).toHaveLength(2);
      for (const [index, time] of plan.extraCorrectTimesMs.entries()) {
        expect(botProgressAt(plan, time)).toBe(0);
        expect(botKeystrokesAt(plan, time)).toEqual({ total: index + 2, correct: index + 1 });
      }
      expect(botKeystrokesAt(plan, botFinishMs(plan))).toEqual({ total: 8, correct: 7 });
    } else {
      expect(plan.extraCorrectTimesMs).toEqual([]);
      const corrected = plan.keyframes.find((frame) => frame.chars === 1);
      if (!corrected) throw new Error("correction manquante");
      expect(botProgressAt(plan, corrected.timeMs - 1)).toBe(0);
      expect(botKeystrokesAt(plan, corrected.timeMs - 1)).toEqual({ total: 1, correct: 0 });
      expect(botKeystrokesAt(plan, botFinishMs(plan))).toEqual({ total: 6, correct: 5 });
    }
    expect(botProgressAt(plan, botFinishMs(plan))).toBe(5);
  });

  it("corrige aussi une faute libre sur le dernier caractère sans dépasser le texte", () => {
    const plan = planBot("a", "noob", "free", () => 0);
    expect(plan.mistakeTimesMs).toHaveLength(1);
    expect(plan.extraCorrectTimesMs).toEqual([]);
    expect(botKeystrokesAt(plan, botFinishMs(plan))).toEqual({ total: 2, correct: 1 });
    expect(botProgressAt(plan, botFinishMs(plan))).toBe(1);
  });

  it("compte une frappe fausse par faute commise, comme la précision du joueur", () => {
    let withMistakes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planBot(TEXT, "intermediate", "blocking", seeded(seed));
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
