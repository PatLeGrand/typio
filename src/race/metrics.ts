import type { RaceSettings } from "./config";

/**
 * Mesures d'une frappe (A-D6, RES-2). Module pur : aucun temps ni DOM, l'appelant fournit
 * le texte, la saisie et la durée écoulée.
 */
export interface Keystrokes {
  /** Frappes qui ajoutent un caractère (Backspace n'en est pas une). */
  total: number;
  /** Frappes dont le caractère était le bon au moment de la frappe. */
  correct: number;
}

export const NO_KEYSTROKES: Keystrokes = { total: 0, correct: 0 };

/** Nombre de caractères tapés à la bonne position (la saisie peut contenir des fautes). */
export function countCorrectChars(typed: string, text: string): number {
  let count = 0;
  const limit = Math.min(typed.length, text.length);
  for (let index = 0; index < limit; index += 1) {
    if (typed[index] === text[index]) count += 1;
  }
  return count;
}

/** MPM = (caractères corrects ÷ 5) ÷ minutes écoulées, arrondi à l'entier ; 0 sans durée. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (!(elapsedMs > 0) || correctChars <= 0) return 0;
  return Math.round(correctChars / 5 / (elapsedMs / 60_000));
}

/** Précision = frappes correctes ÷ frappes totales, en % arrondi ; 100 tant qu'on n'a pas tapé. */
export function computeAccuracy({ total, correct }: Keystrokes): number {
  if (total <= 0) return 100;
  return Math.round((correct / total) * 100);
}

export interface TypedInputResult {
  /** Nouvelle saisie : identique à l'ancienne quand elle est refusée. */
  typed: string;
  keystrokes: Keystrokes;
}

/**
 * Applique un changement du champ de saisie.
 * - Effacer ou raccourcir n'est pas une frappe, et ne retire rien aux compteurs : une faute
 *   corrigée ensuite reste comptée comme fausse.
 * - Mode libre : on peut continuer après une faute, chaque frappe est jugée sur sa position.
 * - Mode bloquant : un caractère faux n'entre pas (il compte comme une frappe fausse).
 * - La saisie ne dépasse jamais la longueur du texte.
 */
export function applyTypedInput(
  previous: string,
  next: string,
  text: string,
  inputMode: RaceSettings["inputMode"],
  keystrokes: Keystrokes,
): TypedInputResult {
  if (next.length <= previous.length) {
    if (inputMode === "blocking" && !text.startsWith(next)) return { typed: previous, keystrokes };
    return { typed: next, keystrokes };
  }

  const bounded = next.slice(0, text.length);
  let total = keystrokes.total;
  let correct = keystrokes.correct;
  for (let index = previous.length; index < bounded.length; index += 1) {
    total += 1;
    if (bounded[index] === text[index]) correct += 1;
  }
  const counted = { total, correct };

  if (inputMode === "blocking" && !text.startsWith(bounded)) return { typed: previous, keystrokes: counted };
  return { typed: bounded, keystrokes: counted };
}
