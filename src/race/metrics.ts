import type { RaceSettings } from "./config";

/**
 * Mesures d'une frappe (A-D6, RES-02). Module pur : aucun temps ni DOM, l'appelant fournit
 * le texte, la saisie et la durée écoulée.
 */
export interface Keystrokes {
  /** Frappes qui ajoutent un caractère (Backspace n'en est pas une). */
  total: number;
  /** Frappes dont le caractère était le bon au moment de la frappe. */
  correct: number;
}

export const NO_KEYSTROKES: Keystrokes = { total: 0, correct: 0 };
export const MAX_FREE_WORD_ERRORS = 2;

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
  /** Caractère attendu si le plafond de fautes bloque encore la saisie. */
  wordCapKey?: string;
  /** Nouvelle saisie : identique à l'ancienne quand elle est refusée. */
  typed: string;
  keystrokes: Keystrokes;
  missedKeys: Record<string, number>;
}

/**
 * Applique un changement du champ de saisie.
 * - Effacer ou raccourcir n'est pas une frappe, et ne retire rien aux compteurs : une faute
 *   corrigée ensuite reste comptée comme fausse.
 * - Mode libre : deux fautes peuvent rester dans un mot. Franchir un espace du texte
 *   verrouille le préfixe, espace compris, quelle que soit la frappe à cette position.
 * - Mode bloquant : un caractère faux n'entre pas (il compte comme une frappe fausse).
 * - La saisie ne dépasse jamais la longueur du texte.
 */
export function applyTypedInput(
  previous: string,
  next: string,
  text: string,
  inputMode: RaceSettings["inputMode"],
  keystrokes: Keystrokes,
  missedKeys: Record<string, number> = {},
): TypedInputResult {
  const free = inputMode === "free";
  const wordStart = free && previous.length > 0 ? text.lastIndexOf(" ", previous.length - 1) + 1 : 0;
  if (next.length <= previous.length) {
    if (free && (next.length < wordStart || !previous.startsWith(next))) return { typed: previous, keystrokes, missedKeys };
    if (inputMode === "blocking" && !text.startsWith(next)) return { typed: previous, keystrokes, missedKeys };
    return { typed: next, keystrokes, missedKeys };
  }
  if (free && !next.startsWith(previous)) return { typed: previous, keystrokes, missedKeys };

  const bounded = next.slice(0, text.length);
  const misses = { ...missedKeys };
  let total = keystrokes.total;
  let correct = keystrokes.correct;
  let typed = previous;
  let wordCapKey: string | undefined;
  let wordErrors = free ? previous.length - wordStart -
    countCorrectChars(previous.slice(wordStart), text.slice(wordStart, previous.length)) : 0;
  for (let offset = previous.length; offset < next.length; offset += 1) {
    const index = free ? typed.length : offset;
    if (index >= text.length) break;
    const char = next[offset];
    const matches = char === text[index];
    total += 1;
    if (matches) correct += 1;
    else {
      // Les clés viennent uniquement du texte, jamais du caractère envoyé par le client.
      const start = /[\uDC00-\uDFFF]/u.test(text[index]) ? index - 1 : index;
      const expected = String.fromCodePoint(text.codePointAt(start)!);
      misses[expected] = (misses[expected] ?? 0) + 1;
      if (free && text[index] !== " ") {
        if (wordErrors >= MAX_FREE_WORD_ERRORS) {
          wordCapKey = expected;
          continue;
        }
        wordErrors += 1;
      }
    }
    if (free) {
      if (text[index] === " ") wordErrors = 0;
      wordCapKey = undefined;
      typed += char;
    }
  }
  const counted = { total, correct };

  if (inputMode === "blocking" && !text.startsWith(bounded)) return { typed: previous, keystrokes: counted, missedKeys: misses };
  return { wordCapKey, typed: free ? typed : bounded, keystrokes: counted, missedKeys: misses };
}
