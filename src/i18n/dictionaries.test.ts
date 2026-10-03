import { describe, expect, it } from "vitest";
import { locales } from "./config";
import { getDictionary } from "./dictionaries";
import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";

/** Liste récursive des chemins de feuilles (« home.tagline »), triés. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key))
      .sort();
  }
  return [prefix];
}

function leafValues(value: unknown): string[] {
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(leafValues);
  return [String(value)];
}

describe("dictionnaires", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(leafPaths(en)).toEqual(leafPaths(fr));
  });

  it("n'ont aucune chaîne vide", () => {
    for (const dictionary of [fr, en]) {
      for (const value of leafValues(dictionary)) expect(value.trim()).not.toBe("");
    }
  });

  it("ont une clé pour chaque locale supportée dans les noms de langue", () => {
    for (const dictionary of [fr, en]) {
      expect(Object.keys(dictionary.language.names).sort()).toEqual([...locales].sort());
    }
  });

  it("getDictionary renvoie le dictionnaire de la locale demandée", () => {
    expect(getDictionary("fr")).toBe(fr);
    expect(getDictionary("en")).toBe(en);
  });
});
