import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";
import type { Locale } from "./config";

/**
 * Le dictionnaire français fait référence : `Record<Locale, Dictionary>`
 * échoue à la compilation si le dictionnaire anglais n'a pas la même forme
 * (clé manquante ou de type différent).
 */
export type Dictionary = typeof fr;

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
