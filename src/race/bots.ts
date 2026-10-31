import type { BotLevel, InputMode } from "../realtime/protocol";
import { computeWpm, type Keystrokes } from "./metrics";

/** Indice = seconde depuis le départ, bornée par la fin du bot et les 600 s de course. */
export function botWpmSeries(plan: BotPlan, endMs: number): number[] {
  const count = Math.min(601, Math.floor(Math.min(endMs, botFinishMs(plan)) / 1000) + 1);
  return Array.from({ length: count }, (_, second) => computeWpm(botProgressAt(plan, second * 1000), second * 1000));
}

/**
 * Simulation des bots (BOT-02, BOT-03, A-D8). Module pur : le hasard est injecté et le temps est un
 * simple paramètre `elapsedMs`, jamais lu sur une horloge. Le bot ne « joue » pas : on
 * précalcule sa frappe en une courbe temps -> caractères corrects, que l'écran (ou, plus tard,
 * le serveur) interroge à chaque image.
 */

/** Vitesse cible en mots par minute (1 mot = 5 caractères, comme la MPM du joueur). */
export const BOT_LEVEL_PROFILES: Record<BotLevel, { minWpm: number; maxWpm: number; errorRate: number }> = {
  noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12 },
  beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08 },
  intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05 },
  expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02 },
  impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005 },
};

export const LEGACY_BOT_LEVEL: Record<"easy" | "normal" | "hard", BotLevel> = {
  easy: "beginner", normal: "intermediate", hard: "expert",
};

/** Variation de vitesse par mot : le temps de chaque mot est multiplié par 1 ± 20 %. */
const WORD_SPEED_VARIATION = 0.2;
/** Probabilité, par mot, d'une courte pause avant de le taper (200 à 800 ms). */
const PAUSE_PROBABILITY = 0.05;
const PAUSE_MIN_MS = 200;
const PAUSE_MAX_MS = 800;
/** Temps de réaction pour remarquer la faute, avant la correction. */
const ERROR_NOTICE_MIN_MS = 150;
const ERROR_NOTICE_MAX_MS = 400;
/** Délai avant la première frappe, après le départ. */
const START_DELAY_MIN_MS = 150;
const START_DELAY_MAX_MS = 450;
/** Facteur de durée des frappes pendant le brouillard. */
export const BOT_FOG_SLOWDOWN_FACTOR = 1.6;

/** Point de la courbe : après `timeMs`, le bot a tapé `chars` caractères corrects. */
interface Keyframe {
  timeMs: number;
  chars: number;
}

/**
 * Courbe affine par morceaux, croissante au sens large : un segment plat est une pause ou
 * une faute en cours de correction. La progression ne recule jamais, car seuls les
 * caractères déjà corrects sont comptés (la frappe fausse n'avance pas le bot).
 */
export interface BotPlan {
  readonly textLength: number;
  readonly keyframes: readonly Keyframe[];
  /** Instants (ms) des frappes fausses, croissants. */
  readonly mistakeTimesMs: readonly number[];
  /** Frappes justes après une faute libre, effacées puis retapées ; sans progression validée. */
  readonly extraCorrectTimesMs: readonly number[];
}

function between(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

/** Difficulté intrinsèque du mot, indépendante du hasard et plafonnée à ×1,5. */
function wordDifficulty(word: string): number {
  return Math.min(1.5, 1 + Math.max(0, word.length - 6) * 0.04 +
    (/[A-ZÀ-ÖØ-Þ]/u.test(word) ? 0.1 : 0) + (/\d/u.test(word) ? 0.1 : 0) +
    (/[^\p{L}\p{N}]/u.test(word) ? 0.1 : 0) + (/[À-ÖØ-öø-ÿ]/u.test(word) ? 0.1 : 0));
}

export function planBot(text: string, level: BotLevel, inputMode: InputMode, random: () => number): BotPlan {
  const keyframes: Keyframe[] = [{ timeMs: 0, chars: 0 }];
  const mistakeTimesMs: number[] = [];
  const extraCorrectTimesMs: number[] = [];
  if (text.length === 0) return { textLength: 0, keyframes, mistakeTimesMs, extraCorrectTimesMs };

  const { minWpm, maxWpm, errorRate } = BOT_LEVEL_PROFILES[level];
  const msPerChar = 60_000 / (between(minWpm, maxWpm, random) * 5);
  const words = text.split(" ");

  // Pauses et fautes ralentissent le bot : on raccourcit d'autant la frappe pure pour que la
  // vitesse moyenne reste proche de la cible, quelle que soit la difficulté.
  const averageWordChars = text.length / words.length;
  const expectedOverheadMs =
    PAUSE_PROBABILITY * ((PAUSE_MIN_MS + PAUSE_MAX_MS) / 2) / averageWordChars +
    errorRate * ((ERROR_NOTICE_MIN_MS + ERROR_NOTICE_MAX_MS) / 2) +
    (START_DELAY_MIN_MS + START_DELAY_MAX_MS) / 2 / text.length;
  // Difficulté moyenne de référence : les mots difficiles restent plus lents, même seuls.
  // Une faute ajoute une frappe en mode bloquant, quatre en moyenne avec les effacements libres.
  const typingScale = Math.max(0.1,
    (msPerChar - expectedOverheadMs) / (msPerChar * 1.1 * (1 + errorRate * (inputMode === "free" ? 4 : 1))));

  let timeMs = 0;
  let chars = 0;
  const push = () => keyframes.push({ timeMs, chars });
  const wait = (durationMs: number) => {
    timeMs += durationMs;
    push();
  };

  wait(between(START_DELAY_MIN_MS, START_DELAY_MAX_MS, random));

  words.forEach((word, index) => {
    // L'espace qui suit le mot fait partie de sa frappe, sauf pour le dernier mot.
    const wordChars = word.length + (index < words.length - 1 ? 1 : 0);
    const speed = 1 + (random() * 2 - 1) * WORD_SPEED_VARIATION;
    const charMs = msPerChar * speed * wordDifficulty(word) * typingScale;

    if (random() < PAUSE_PROBABILITY) wait(between(PAUSE_MIN_MS, PAUSE_MAX_MS, random));

    for (let offset = 0; offset < wordChars; offset++) {
      if (random() < errorRate) {
        wait(charMs);
        mistakeTimesMs.push(timeMs);
        if (inputMode === "free") {
          const continued = Math.min(2, text.length - chars - 1, Math.floor(random() * 3));
          for (let extra = 0; extra < continued; extra++) {
            wait(charMs);
            extraCorrectTimesMs.push(timeMs);
          }
          wait(between(ERROR_NOTICE_MIN_MS, ERROR_NOTICE_MAX_MS, random));
          // Backspace prend du temps mais n'entre pas dans la précision (voir metrics.ts).
          wait((continued + 1) * charMs);
        } else {
          wait(between(ERROR_NOTICE_MIN_MS, ERROR_NOTICE_MAX_MS, random));
        }
      }
      timeMs += charMs;
      chars++;
      push();
    }
  });

  return { textLength: text.length, keyframes, mistakeTimesMs, extraCorrectTimesMs };
}

/** Garde tout le passé, puis recalcule seulement le texte restant avec le même moteur. */
export function replanBot(
  plan: BotPlan,
  elapsedMs: number,
  newText: string,
  level: BotLevel,
  inputMode: InputMode,
  random: () => number,
  slowdown?: { untilMs: number; factor: number },
): BotPlan {
  const chars = botProgressAt(plan, elapsedMs);
  const past = plan.keyframes.filter((frame) => frame.timeMs <= elapsedMs);
  const from = past[past.length - 1];
  const to = plan.keyframes.find((frame) => frame.timeMs > elapsedMs);
  // Préserver aussi la fraction du segment passé : son arrondi donne toujours `chars`.
  const boundaryChars = to
    ? from.chars + (to.chars - from.chars) * (elapsedMs - from.timeMs) / (to.timeMs - from.timeMs)
    : chars;
  const suffix = planBot(newText.slice(chars), level, inputMode, random);
  const factor = Math.max(1, slowdown?.factor ?? 1);
  const slowDuration = Math.max(0, (slowdown?.untilMs ?? elapsedMs) - elapsedMs) / factor;
  const timeAt = (timeMs: number) => elapsedMs + timeMs + Math.min(timeMs, slowDuration) * (factor - 1);
  const future = [...suffix.keyframes];
  // Couper le segment à la fin du brouillard pour retrouver immédiatement la vitesse normale.
  const nextIndex = future.findIndex((frame) => frame.timeMs > slowDuration);
  if (factor > 1 && slowDuration > 0 && nextIndex > 0) {
    const before = future[nextIndex - 1];
    const after = future[nextIndex];
    future.splice(nextIndex, 0, {
      timeMs: slowDuration,
      chars: before.chars + (after.chars - before.chars) *
        (slowDuration - before.timeMs) / (after.timeMs - before.timeMs),
    });
  }
  return {
    textLength: newText.length,
    keyframes: [...past, { timeMs: elapsedMs, chars: boundaryChars },
      ...future.map((frame) => ({ timeMs: timeAt(frame.timeMs), chars: chars + frame.chars }))],
    mistakeTimesMs: [...plan.mistakeTimesMs.filter((time) => time <= elapsedMs),
      ...suffix.mistakeTimesMs.map(timeAt)],
    extraCorrectTimesMs: [...plan.extraCorrectTimesMs.filter((time) => time <= elapsedMs),
      ...suffix.extraCorrectTimesMs.map(timeAt)],
  };
}

/** Nombre de caractères corrects tapés par le bot, `elapsedMs` après le départ (0..longueur). */
export function botProgressAt(plan: BotPlan, elapsedMs: number): number {
  const { keyframes, textLength } = plan;
  if (!(elapsedMs > 0)) return 0;
  const last = keyframes[keyframes.length - 1];
  if (elapsedMs >= last.timeMs) return textLength;

  // Recherche dichotomique du segment [low, low + 1] qui contient `elapsedMs`.
  let low = 0;
  let high = keyframes.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (keyframes[mid].timeMs <= elapsedMs) low = mid;
    else high = mid;
  }
  const from = keyframes[low];
  const to = keyframes[high];
  if (to.timeMs === from.timeMs) return Math.min(textLength, from.chars);
  const ratio = (elapsedMs - from.timeMs) / (to.timeMs - from.timeMs);
  return Math.min(textLength, Math.floor(from.chars + (to.chars - from.chars) * ratio));
}

/** Durée totale (ms) pour finir le texte ; à cet instant `botProgressAt` rend la longueur. */
export function botFinishMs(plan: BotPlan): number {
  return Math.ceil(plan.keyframes[plan.keyframes.length - 1].timeMs);
}

/**
 * Frappes du bot `elapsedMs` après le départ, au sens de la précision du joueur : chaque caractère
 * correct est une frappe juste, y compris s'il est ensuite effacé ; chaque faute compte une fois.
 */
export function botKeystrokesAt(plan: BotPlan, elapsedMs: number): Keystrokes {
  const correct = botProgressAt(plan, elapsedMs) +
    plan.extraCorrectTimesMs.filter((timeMs) => timeMs <= elapsedMs).length;
  const mistakes = plan.mistakeTimesMs.filter((timeMs) => timeMs <= elapsedMs).length;
  return { total: correct + mistakes, correct };
}
