import type { RaceSettings } from "./config";
import { SENTENCES_EN } from "./data/sentences.en";
import { SENTENCES_FR } from "./data/sentences.fr";
import { WORDS_EN } from "./data/words.en";
import { WORDS_FR } from "./data/words.fr";

/**
 * Génération du texte d'une course (TEXTE-1, TEXTE-2, H-10, H-11).
 * Module pur : ni DOM ni React, et le hasard est injecté pour que le serveur temps réel
 * puisse le réutiliser et que les tests soient déterministes.
 */
export type TextGenerationInput = Pick<
  RaceSettings,
  "textMode" | "language" | "accents" | "length" | "excludedCharacters"
>;

export type TextGenerationResult =
  | { ok: true; text: string }
  | { ok: false; error: "NO_TEXT_AVAILABLE" };

/** Longueur visée selon le réglage ; le résultat reste dans ±25 % (TEXTE-1). */
export const TEXT_TARGET_LENGTH: Record<RaceSettings["length"], number> = {
  short: 100,
  medium: 200,
  long: 350,
};
const TOLERANCE = 0.25;

const SENTENCES: Record<RaceSettings["language"], readonly string[]> = {
  fr: SENTENCES_FR,
  en: SENTENCES_EN,
};
const WORDS: Record<RaceSettings["language"], readonly string[]> = {
  fr: WORDS_FR,
  en: WORDS_EN,
};

/** Retire les diacritiques ; `œ` et `æ` n'ont pas de forme décomposée, on les traite à part. */
function stripDiacritics(text: string): string {
  return text
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function hasAccent(text: string): boolean {
  return stripDiacritics(text) !== text;
}

/** Les caractères exclus sont séparés par des espaces ; la casse des lettres est ignorée. */
export function parseExcludedCharacters(raw: string): ReadonlySet<string> {
  const set = new Set<string>();
  for (const char of raw.toLowerCase()) {
    if (!/\s/u.test(char)) set.add(char);
  }
  return set;
}

function containsExcluded(text: string, excluded: ReadonlySet<string>): boolean {
  if (excluded.size === 0) return false;
  for (const char of text.toLowerCase()) {
    if (excluded.has(char)) return true;
  }
  return false;
}

/** Tire un entier dans [0, size) en se protégeant d'un `random` qui renverrait 1. */
function pickIndex(size: number, random: () => number): number {
  return Math.min(size - 1, Math.floor(random() * size));
}

/**
 * Assemble des éléments distincts, séparés par une espace, jusqu'à atteindre la cible sans
 * jamais dépasser la borne haute. Rend `null` si la borne basse reste hors d'atteinte.
 */
function assemble(
  pool: readonly string[],
  targetLength: number,
  random: () => number,
): string | null {
  const min = Math.ceil(targetLength * (1 - TOLERANCE));
  const max = Math.floor(targetLength * (1 + TOLERANCE));
  const remaining = [...pool];
  let text = "";

  while (text.length < targetLength) {
    const used = text.length === 0 ? 0 : text.length + 1;
    const fitting = remaining.filter((item) => used + item.length <= max);
    if (fitting.length === 0) break;
    const chosen = fitting[pickIndex(fitting.length, random)];
    remaining.splice(remaining.indexOf(chosen), 1);
    text = text.length === 0 ? chosen : `${text} ${chosen}`;
  }

  return text.length >= min ? text : null;
}

export function generateRaceText(
  input: TextGenerationInput,
  random: () => number,
): TextGenerationResult {
  const excluded = parseExcludedCharacters(input.excludedCharacters);

  let pool: string[];
  if (input.textMode === "sentences") {
    // Une phrase ne se retouche pas : si elle contient un accent ou un caractère exclu, on l'écarte.
    pool = SENTENCES[input.language].filter(
      (sentence) => (input.accents || !hasAccent(sentence)) && !containsExcluded(sentence, excluded),
    );
  } else {
    // Un mot sans accent reste un mot valide : on le remplace par sa forme simple, puis on filtre.
    const source = WORDS[input.language];
    const candidates = input.accents ? source : source.map(stripDiacritics);
    pool = [...new Set(candidates)].filter((word) => !containsExcluded(word, excluded));
  }

  const text = assemble(pool, TEXT_TARGET_LENGTH[input.length], random);
  return text === null ? { ok: false, error: "NO_TEXT_AVAILABLE" } : { ok: true, text };
}
