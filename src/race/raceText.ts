import type { RaceSettings } from "./config";
import { generateRaceText } from "./textGenerator";

const MAX_ATTEMPTS = 8;

/**
 * Texte d'une course (TEXTE-1, TEXTE-2). Le générateur peut échouer par malchance du tirage
 * même quand les filtres laissent des phrases : on réessaie quelques fois avant de conclure
 * qu'aucun texte n'est disponible (`null`). `previous` évite de rejouer le même texte (AC-3, AC-6).
 */
export function createRaceText(
  settings: RaceSettings,
  random: () => number,
  previous?: string,
): string | null {
  let fallback: string | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = generateRaceText(settings, random);
    if (!result.ok) continue;
    if (result.text !== previous) return result.text;
    fallback = result.text;
  }
  return fallback;
}
