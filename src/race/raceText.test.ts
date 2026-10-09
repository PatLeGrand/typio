import { describe, expect, it } from "vitest";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "./config";
import { createRaceText } from "./raceText";

function counter(): () => number {
  let state = 0;
  return () => {
    state = (state + 0.137) % 1;
    return state;
  };
}

describe("createRaceText (AC-3)", () => {
  it("rend un texte, différent du précédent quand le tirage le permet", () => {
    const random = counter();
    const first = createRaceText(DEFAULT_RACE_SETTINGS, random);
    expect(first).not.toBeNull();
    const second = createRaceText(DEFAULT_RACE_SETTINGS, random, first ?? undefined);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("rend null quand les filtres ne laissent aucun texte", () => {
    const settings: RaceSettings = { ...DEFAULT_RACE_SETTINGS, excludedCharacters: "a e i o u y" };
    expect(createRaceText(settings, counter())).toBeNull();
  });

  it("garde le texte précédent plutôt que rien quand il n'y a pas d'autre choix", () => {
    const settings: RaceSettings = { ...DEFAULT_RACE_SETTINGS, textMode: "words", length: "short" };
    const text = createRaceText(settings, () => 0);
    expect(createRaceText(settings, () => 0, text ?? undefined)).toBe(text);
  });
});
