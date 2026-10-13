import { describe, expect, it } from "vitest";
import { SENTENCES_EN } from "./data/sentences.en";
import { SENTENCES_FR } from "./data/sentences.fr";
import { WORDS_EN } from "./data/words.en";
import { WORDS_FR } from "./data/words.fr";
import {
  generateRaceText,
  parseExcludedCharacters,
  TEXT_TARGET_LENGTH,
  type TextGenerationInput,
} from "./textGenerator";

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

const BASE: TextGenerationInput = {
  textMode: "sentences",
  language: "fr",
  accents: true,
  length: "medium",
  excludedCharacters: "",
};

function textOf(input: TextGenerationInput, seed: number): string {
  const result = generateRaceText(input, seeded(seed));
  if (!result.ok) throw new Error(`NO_TEXT_AVAILABLE pour ${JSON.stringify(input)} graine ${seed}`);
  return result.text;
}

const LENGTHS = ["short", "medium", "long"] as const;
const MODES = ["sentences", "words"] as const;
const LANGUAGES = ["fr", "en"] as const;

describe("données de textes", () => {
  it("fournit au moins 30 phrases (40 à 140 caractères) et 200 mots par langue", () => {
    for (const sentences of [SENTENCES_FR, SENTENCES_EN]) {
      expect(sentences.length).toBeGreaterThanOrEqual(30);
      expect(new Set(sentences).size).toBe(sentences.length);
      for (const sentence of sentences) {
        expect(sentence.length).toBeGreaterThanOrEqual(40);
        expect(sentence.length).toBeLessThanOrEqual(140);
        expect(sentence).toBe(sentence.trim());
        expect(sentence).not.toMatch(/ {2}/);
      }
    }
    for (const words of [WORDS_FR, WORDS_EN]) {
      expect(words.length).toBeGreaterThanOrEqual(200);
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) expect(word).toBe(word.toLowerCase());
    }
  });
});

describe("generateRaceText", () => {
  it("respecte la langue : les phrases viennent de la banque de la langue choisie", () => {
    const fr = textOf({ ...BASE, language: "fr", length: "short" }, 1);
    const en = textOf({ ...BASE, language: "en", length: "short" }, 1);
    expect(SENTENCES_FR.some((sentence) => fr.includes(sentence))).toBe(true);
    expect(SENTENCES_EN.some((sentence) => en.includes(sentence))).toBe(true);
    expect(SENTENCES_EN.some((sentence) => fr.includes(sentence))).toBe(false);
    expect(SENTENCES_FR.some((sentence) => en.includes(sentence))).toBe(false);
  });

  it("respecte la langue en mode mots", () => {
    for (const language of LANGUAGES) {
      const bank = new Set(language === "fr" ? WORDS_FR : WORDS_EN);
      const words = textOf({ ...BASE, textMode: "words", language }, 3).split(" ");
      for (const word of words) expect(bank.has(word)).toBe(true);
    }
  });

  it("reste dans ±25 % de la cible, pour toutes les longueurs, modes et langues, sur 50 graines", () => {
    for (const textMode of MODES) {
      for (const language of LANGUAGES) {
        for (const length of LENGTHS) {
          const target = TEXT_TARGET_LENGTH[length];
          for (let seed = 1; seed <= 50; seed++) {
            const text = textOf({ ...BASE, textMode, language, length }, seed);
            expect(text.length).toBeGreaterThanOrEqual(target * 0.75);
            expect(text.length).toBeLessThanOrEqual(target * 1.25);
          }
        }
      }
    }
  });

  it("rend des textes de longueur croissante de court à long", () => {
    const lengths = LENGTHS.map((length) => textOf({ ...BASE, length }, 7).length);
    expect(lengths[0]).toBeLessThan(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[2]);
  });

  it("donne des textes différents avec des graines différentes", () => {
    for (const textMode of MODES) {
      const texts = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) texts.add(textOf({ ...BASE, textMode }, seed));
      expect(texts.size).toBeGreaterThan(15);
    }
  });

  it("donne le même texte avec la même graine", () => {
    for (const textMode of MODES) {
      expect(textOf({ ...BASE, textMode }, 42)).toBe(textOf({ ...BASE, textMode }, 42));
    }
  });

  it("ne produit ni espace en bord ni espaces doubles", () => {
    for (const textMode of MODES) {
      for (const length of LENGTHS) {
        for (let seed = 1; seed <= 20; seed++) {
          const text = textOf({ ...BASE, textMode, length }, seed);
          expect(text).toBe(text.trim());
          expect(text).not.toMatch(/\s{2}/);
        }
      }
    }
  });

  it("n'utilise pas deux fois la même phrase dans un texte", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const text = textOf({ ...BASE, length: "long" }, seed);
      for (const sentence of SENTENCES_FR) {
        expect(text.split(sentence).length - 1).toBeLessThanOrEqual(1);
      }
    }
  });

  it("sans accents, les phrases accentuées sont exclues", () => {
    for (const length of LENGTHS) {
      for (let seed = 1; seed <= 30; seed++) {
        const text = textOf({ ...BASE, accents: false, length }, seed);
        expect(text.normalize("NFD")).not.toMatch(/\p{M}/u);
        expect(text).not.toMatch(/[œæ]/);
      }
    }
  });

  it("avec accents, les phrases accentuées restent possibles", () => {
    const texts = Array.from({ length: 30 }, (_, seed) => textOf(BASE, seed + 1));
    expect(texts.some((text) => /[éèàçôîï]/.test(text))).toBe(true);
  });

  it("sans accents, un mot est remplacé par sa forme sans diacritiques (œ devient oe)", () => {
    const all = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const word of textOf({ ...BASE, textMode: "words", accents: false, length: "long" }, seed).split(" ")) {
        all.add(word);
      }
    }
    for (const word of all) expect(word).toMatch(/^[a-z]+$/);
    expect(all.has("ecole")).toBe(true);
    expect(all.has("coeur")).toBe(true);
    expect(all.has("etre")).toBe(true);
  });

  it("les mots accentués restent intacts avec accents", () => {
    const all = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      for (const word of textOf({ ...BASE, textMode: "words", length: "long" }, seed).split(" ")) {
        all.add(word);
      }
    }
    expect(all.has("école")).toBe(true);
    expect(all.has("cœur")).toBe(true);
  });

  it("exclut un caractère de la liste, casse comprise, en mode mots", () => {
    for (const language of LANGUAGES) {
      for (let seed = 1; seed <= 30; seed++) {
        const text = textOf({ ...BASE, textMode: "words", language, excludedCharacters: "e" }, seed);
        expect(text).not.toMatch(/e/i);
      }
    }
    const upper = textOf({ ...BASE, textMode: "words", excludedCharacters: "E" }, 5);
    expect(upper).not.toMatch(/e/i);
  });

  it("exclut les phrases contenant un caractère exclu, plusieurs caractères séparés par des espaces", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const text = textOf({ ...BASE, excludedCharacters: "z , :" }, seed);
      expect(text).not.toMatch(/[z,:]/i);
    }
  });

  it("combine accents désactivés et caractères exclus", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const text = textOf({ ...BASE, textMode: "words", accents: false, excludedCharacters: "a o" }, seed);
      expect(text).not.toMatch(/[ao]/i);
      expect(text.normalize("NFD")).not.toMatch(/\p{M}/u);
    }
  });

  it("rend NO_TEXT_AVAILABLE quand les filtres ne laissent rien", () => {
    const noVowels = "a e i o u y é è à";
    for (const textMode of MODES) {
      for (const language of LANGUAGES) {
        for (const length of LENGTHS) {
          expect(
            generateRaceText({ ...BASE, textMode, language, length, excludedCharacters: noVowels }, seeded(1)),
          ).toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
        }
      }
    }
  });

  it("rend NO_TEXT_AVAILABLE quand il reste trop peu de matière pour la borne basse", () => {
    // Exclure presque tout laisse quelques mots, loin de la borne basse du texte long.
    const result = generateRaceText(
      { ...BASE, textMode: "words", language: "en", length: "long", excludedCharacters: "a e i o u r s t n l" },
      seeded(1),
    );
    expect(result).toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
  });

  it("supporte un random qui renvoie la borne haute de la plage utile", () => {
    const result = generateRaceText(BASE, () => 0.999999999);
    expect(result.ok).toBe(true);
    const zero = generateRaceText(BASE, () => 0);
    expect(zero.ok).toBe(true);
  });
});

describe("parseExcludedCharacters", () => {
  it("ignore les espaces et la casse", () => {
    expect([...parseExcludedCharacters("@ # %  E")].sort()).toEqual(["#", "%", "@", "e"]);
    expect(parseExcludedCharacters("   ").size).toBe(0);
    expect(parseExcludedCharacters("").size).toBe(0);
  });
});
