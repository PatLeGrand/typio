import type { RaceSettings } from "./config";
import { SENTENCES_EN } from "./data/sentences.en";
import { SENTENCES_FR } from "./data/sentences.fr";
import { RARE_WORDS_EN, WORDS_EN } from "./data/words.en";
import { RARE_WORDS_FR, WORDS_FR } from "./data/words.fr";
import type { TextComplexity, TextLanguage } from "@/realtime/protocol";

/**
 * Génération du texte d'une course (CONF-03, CONF-02, CONF-04, CONF-05, CONF-06, CONF-07, H-10, H-11).
 * Module pur : ni DOM ni React, et le hasard est injecté pour que le serveur temps réel
 * puisse le réutiliser et que les tests soient déterministes.
 */
export type TextGenerationInput = Pick<
  RaceSettings,
  | "textMode"
  | "language"
  | "accents"
  | "length"
  | "excludedCharacters"
  | "complexity"
  | "punctuation"
  | "numbers"
  | "uppercase"
>;

export type TextGenerationResult =
  | { ok: true; text: string }
  | { ok: false; error: "NO_TEXT_AVAILABLE" };

/** Longueur visée selon le réglage ; le résultat reste dans ±25 % (CONF-04). */
export const TEXT_TARGET_LENGTH: Record<RaceSettings["length"], number> = {
  short: 100,
  medium: 200,
  long: 350,
};
const TOLERANCE = 0.25;

// ── Complexité (CONF-05) : critères mesurables ──────────────────────────────

/** Mode mots, facile : mots de 5 lettres au plus. */
export const EASY_MAX_WORD_LENGTH = 5;
/** Mode mots, difficile : mots de 6 lettres ou plus, liste courante + liste de mots rares. */
export const HARD_MIN_WORD_LENGTH = 6;

/**
 * Mode phrases : chaque phrase est classée par `classifySentence`. Mots = suites de lettres
 * (l'apostrophe et le trait d'union séparent). Signes spéciaux = ponctuation hors `. , '`.
 * Difficile : longueur moyenne >= 5.2, ou mot le plus long >= 11, ou >= 2 signes spéciaux.
 * Facile (sinon) : longueur moyenne <= 4.0, mot le plus long <= 8 et aucun signe spécial.
 * Moyen : tout le reste.
 */
export const SENTENCE_COMPLEXITY_THRESHOLDS = {
  easyMaxAverageWordLength: 4.0,
  easyMaxLongestWord: 8,
  hardMinAverageWordLength: 5.2,
  hardMinLongestWord: 11,
  hardMinSpecialSigns: 2,
} as const;

/** Ponctuation ajoutée en mode mots (CONF-06) : une marque tous les `PUNCTUATION_EVERY` jetons. */
export const PUNCTUATION_EVERY = 6;
/** Un nombre tous les `NUMBER_EVERY` jetons quand l'option nombres est active. */
export const NUMBER_EVERY = 8;
/** Marques possibles selon la complexité ; `()` entoure le mot de parenthèses. */
export const WORD_PUNCTUATION_MARKS: Record<TextComplexity, readonly string[]> = {
  easy: [".", ","],
  medium: [".", ",", "?", "!"],
  hard: [".", ",", "?", "!", ";", ":", "()"],
};

const SPECIAL_SIGNS = /[;:!?«»"()…–]/g;

/** Classe une phrase par des mesures calculées, jamais par une étiquette (CONF-05). */
export function classifySentence(sentence: string): TextComplexity {
  const t = SENTENCE_COMPLEXITY_THRESHOLDS;
  const words = sentence.match(/\p{L}+/gu) ?? [];
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  const average = words.length === 0 ? 0 : letters / words.length;
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
  const specials = (sentence.match(SPECIAL_SIGNS) ?? []).length;
  if (average >= t.hardMinAverageWordLength || longest >= t.hardMinLongestWord || specials >= t.hardMinSpecialSigns) {
    return "hard";
  }
  if (average <= t.easyMaxAverageWordLength && longest <= t.easyMaxLongestWord && specials === 0) return "easy";
  return "medium";
}

function byComplexity(sentences: readonly string[]): Record<TextComplexity, readonly string[]> {
  return {
    easy: sentences.filter((sentence) => classifySentence(sentence) === "easy"),
    medium: sentences.filter((sentence) => classifySentence(sentence) === "medium"),
    hard: sentences.filter((sentence) => classifySentence(sentence) === "hard"),
  };
}

export const SENTENCES: Record<RaceSettings["language"], Record<TextComplexity, readonly string[]>> = {
  fr: byComplexity(SENTENCES_FR),
  en: byComplexity(SENTENCES_EN),
};
const WORDS: Record<RaceSettings["language"], readonly string[]> = {
  fr: WORDS_FR,
  en: WORDS_EN,
};
const RARE_WORDS: Record<RaceSettings["language"], readonly string[]> = {
  fr: RARE_WORDS_FR,
  en: RARE_WORDS_EN,
};

/** Ponctuation retirée quand l'option est désactivée ; `.` et `,` entre deux chiffres (décimaux) restent. */
function removePunctuation(sentence: string): string {
  return sentence
    .replace(/[;:!?«»"()…–]|(?<!\d)[.,]|[.,](?!\d)/gu, "")
    .replace(/\s-\s/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

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

/** Tirages successifs avant de conclure que la borne basse est hors d'atteinte (phrases longues, texte court). */
const ASSEMBLE_ATTEMPTS = 20;

/**
 * Assemble des éléments distincts, séparés par une espace, jusqu'à atteindre la cible sans
 * jamais dépasser la borne haute. Rend `null` si la borne basse reste hors d'atteinte.
 */
function assemble(
  pool: readonly string[],
  targetLength: number,
  random: () => number,
): string | null {
  for (let attempt = 0; attempt < ASSEMBLE_ATTEMPTS; attempt += 1) {
    const text = assembleOnce(pool, targetLength, random);
    if (text !== null) return text;
  }
  return null;
}

function assembleOnce(
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

/** Nombre inséré en mode mots : 1 à 2 chiffres (facile), jusqu'à 4 (moyen), plus des décimaux (difficile). */
function randomNumber(complexity: TextComplexity, language: TextLanguage, random: () => number): string {
  const integer = (digits: number) => pickIndex(10 ** digits, random).toString();
  if (complexity === "easy") return integer(2);
  if (complexity === "medium" || random() < 0.5) return integer(4);
  const separator = language === "fr" ? "," : ".";
  return `${integer(2)}${separator}${1 + pickIndex(99, random)}`;
}

/** Plus grand ajout possible à un mot : nombre décimal + marque (`(` et `)` comptent deux). */
const MAX_TOKEN_OVERHEAD = 10;

/**
 * Mode mots : assemble des jetons séparés par une espace. Des mots distincts, un nombre tous
 * les `NUMBER_EVERY` jetons et une marque tous les `PUNCTUATION_EVERY` jetons si les options
 * sont actives. Un nombre ou une marque qui contiendrait un caractère exclu est remplacé par
 * un mot nu : la contrainte porte sur le texte final (CONF-07).
 */
function assembleWords(
  pool: readonly string[],
  input: TextGenerationInput,
  excluded: ReadonlySet<string>,
  random: () => number,
): string | null {
  const targetLength = TEXT_TARGET_LENGTH[input.length];
  const min = Math.ceil(targetLength * (1 - TOLERANCE));
  const max = Math.floor(targetLength * (1 + TOLERANCE));
  const remaining = [...pool];
  const marks = WORD_PUNCTUATION_MARKS[input.complexity].filter(
    (mark) => !containsExcluded(mark, excluded),
  );
  let text = "";
  let index = 0;
  let capitalizeNext = input.uppercase;

  while (text.length < targetLength) {
    const used = text.length === 0 ? 0 : text.length + 1;
    let token: string | null = null;
    if (input.numbers && index % NUMBER_EVERY === NUMBER_EVERY - 1) {
      const number = randomNumber(input.complexity, input.language, random);
      if (!containsExcluded(number, excluded)) token = number;
    }
    if (token === null) {
      const fitting = remaining.filter((item) => used + item.length + MAX_TOKEN_OVERHEAD <= max);
      if (fitting.length === 0) break;
      const chosen = fitting[pickIndex(fitting.length, random)];
      remaining.splice(remaining.indexOf(chosen), 1);
      token = chosen;
    }
    if (capitalizeNext) token = capitalize(token);
    capitalizeNext = false;
    if (input.punctuation && marks.length > 0 && index % PUNCTUATION_EVERY === PUNCTUATION_EVERY - 1) {
      const mark = marks[pickIndex(marks.length, random)];
      token = mark === "()" ? `(${token})` : `${token}${mark}`;
      capitalizeNext = input.uppercase && (mark === "." || mark === "?" || mark === "!");
    }
    text = text.length === 0 ? token : `${text} ${token}`;
    index += 1;
  }

  return text.length >= min && text.length <= max ? text : null;
}

export function generateRaceText(
  input: TextGenerationInput,
  random: () => number,
): TextGenerationResult {
  const excluded = parseExcludedCharacters(input.excludedCharacters);

  if (input.textMode === "sentences") {
    // Une phrase ne se retouche que par les options (ponctuation, majuscules) : on transforme
    // d'abord, puis on écarte ce qui contient un accent ou un caractère exclu dans sa forme finale.
    const pool = [
      ...new Set(
        SENTENCES[input.language][input.complexity]
          .filter((sentence) => (input.numbers || !/\d/u.test(sentence)) && (input.accents || !hasAccent(sentence)))
          .map((sentence) => {
            const punctuated = input.punctuation ? sentence : removePunctuation(sentence);
            return input.uppercase ? punctuated : punctuated.toLowerCase();
          })
          .filter((sentence) => !containsExcluded(sentence, excluded)),
      ),
    ];
    const text = assemble(pool, TEXT_TARGET_LENGTH[input.length], random);
    return text === null ? { ok: false, error: "NO_TEXT_AVAILABLE" } : { ok: true, text };
  }

  // Un mot sans accent reste un mot valide : on le remplace par sa forme simple, puis on filtre.
  const source =
    input.complexity === "hard"
      ? [...WORDS[input.language], ...RARE_WORDS[input.language]]
      : WORDS[input.language];
  const candidates = input.accents ? source : source.map(stripDiacritics);
  const pool = [...new Set(candidates)].filter((word) => {
    const length = [...word].length;
    const fits =
      input.complexity === "easy"
        ? length <= EASY_MAX_WORD_LENGTH
        : input.complexity === "hard"
          ? length >= HARD_MIN_WORD_LENGTH
          : true;
    return fits && !containsExcluded(word, excluded);
  });
  const text = assembleWords(pool, input, excluded, random);
  return text === null ? { ok: false, error: "NO_TEXT_AVAILABLE" } : { ok: true, text };
}
