import type { RaceSettings } from "./config";
import type { Keystrokes } from "./metrics";

/**
 * Simulation des bots (BOT-2, A-D8). Module pur : le hasard est injecté et le temps est un
 * simple paramètre `elapsedMs`, jamais lu sur une horloge. Le bot ne « joue » pas : on
 * précalcule sa frappe en une courbe temps -> caractères corrects, que l'écran (ou, plus tard,
 * le serveur) interroge à chaque image.
 */
export type BotDifficulty = RaceSettings["botDifficulty"];

/** Vitesse cible en mots par minute (1 mot = 5 caractères, comme la MPM du joueur). */
export const BOT_TARGET_WPM: Record<BotDifficulty, number> = { easy: 25, normal: 40, hard: 60 };

/** Variation de vitesse par mot : le temps de chaque mot est multiplié par 1 ± 20 %. */
const WORD_SPEED_VARIATION = 0.2;
/** Probabilité, par mot, d'une courte pause avant de le taper (200 à 800 ms). */
const PAUSE_PROBABILITY = 0.05;
const PAUSE_MIN_MS = 200;
const PAUSE_MAX_MS = 800;
/** Probabilité, par mot, d'une faute corrigée : frappe fausse, effacement, puis reprise. */
const ERROR_PROBABILITY = 0.03;
/** Temps de réaction pour remarquer la faute, avant d'effacer (en plus de deux frappes). */
const ERROR_NOTICE_MIN_MS = 150;
const ERROR_NOTICE_MAX_MS = 400;
/** Délai avant la première frappe, après le départ. */
const START_DELAY_MIN_MS = 150;
const START_DELAY_MAX_MS = 450;

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
  /** Instants (ms) des frappes fausses, croissants : chacune sera effacée puis retapée juste. */
  readonly mistakeTimesMs: readonly number[];
}

function between(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

export function planBot(text: string, difficulty: BotDifficulty, random: () => number): BotPlan {
  const keyframes: Keyframe[] = [{ timeMs: 0, chars: 0 }];
  const mistakeTimesMs: number[] = [];
  if (text.length === 0) return { textLength: 0, keyframes, mistakeTimesMs };

  const msPerChar = 60_000 / (BOT_TARGET_WPM[difficulty] * 5);
  const words = text.split(" ");

  // Pauses et fautes ralentissent le bot : on raccourcit d'autant la frappe pure pour que la
  // vitesse moyenne reste proche de la cible, quelle que soit la difficulté.
  const averageWordChars = text.length / words.length;
  const expectedOverheadMs =
    PAUSE_PROBABILITY * ((PAUSE_MIN_MS + PAUSE_MAX_MS) / 2) +
    ERROR_PROBABILITY * (2 * msPerChar + (ERROR_NOTICE_MIN_MS + ERROR_NOTICE_MAX_MS) / 2);
  const pureMs = averageWordChars * msPerChar;
  const typingScale = pureMs / (pureMs + expectedOverheadMs);

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
    const wordMs = wordChars * msPerChar * speed * typingScale;

    if (random() < PAUSE_PROBABILITY) wait(between(PAUSE_MIN_MS, PAUSE_MAX_MS, random));

    // La faute survient après au moins un caractère juste, jamais sur le tout premier.
    const hasError = random() < ERROR_PROBABILITY;
    const errorAt = hasError ? 1 + Math.floor(random() * wordChars) : 0;
    const beforeError = hasError ? errorAt : wordChars;

    timeMs += (wordMs * beforeError) / wordChars;
    chars += beforeError;
    push();

    if (hasError) {
      mistakeTimesMs.push(timeMs);
      wait(2 * msPerChar + between(ERROR_NOTICE_MIN_MS, ERROR_NOTICE_MAX_MS, random));
      const afterError = wordChars - errorAt;
      if (afterError > 0) {
        timeMs += (wordMs * afterError) / wordChars;
        chars += afterError;
        push();
      }
    }
  });

  return { textLength: text.length, keyframes, mistakeTimesMs };
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
 * correct est une frappe juste, chaque faute (déjà commise à cet instant) une frappe fausse.
 */
export function botKeystrokesAt(plan: BotPlan, elapsedMs: number): Keystrokes {
  const correct = botProgressAt(plan, elapsedMs);
  const mistakes = plan.mistakeTimesMs.filter((timeMs) => timeMs <= elapsedMs).length;
  return { total: correct + mistakes, correct };
}
