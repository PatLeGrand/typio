import { describe, expect, it } from "vitest";
import { AUTH_ERROR_CODES } from "@/auth/types";
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

describe("messages d'erreur d'authentification", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("chaque code de AuthErrorCode a un message (%s)", (_locale, dictionary) => {
    const messages: Record<string, string> = dictionary.auth.errors;
    for (const code of AUTH_ERROR_CODES) {
      expect(messages[code], `message manquant pour ${code}`).toEqual(expect.any(String));
      expect(messages[code].trim()).not.toBe("");
    }
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ])("le dictionnaire n'a aucun message sans code correspondant (%s)", (_locale, dictionary) => {
    expect(Object.keys(dictionary.auth.errors).sort()).toEqual([...AUTH_ERROR_CODES].sort());
  });
});
