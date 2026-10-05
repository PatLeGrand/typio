/**
 * Détection des couleurs « en dur » dans le code source des composants et des
 * pages. Seuls les tokens de `globals.css` (bg-surface, text-accent-text…) sont
 * permis, pour que la refonte graphique n'ait qu'à changer ces tokens.
 * `bg-transparent` et `currentColor` restent autorisés.
 */

const COLOR_UTILITIES =
  "(?:bg|text|border|border-[xytrblse]|ring|ring-offset|fill|stroke|outline|shadow|from|via|to|divide|accent|caret|decoration|placeholder)";

const PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const NAMED_COLORS = `white|black|${PALETTES}`;

const RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "hexadécimal", pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "fonction de couleur", pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/g },
  { name: "white/black Tailwind", pattern: new RegExp(`\\b${COLOR_UTILITIES}-(?:white|black)\\b`, "g") },
  { name: "palette Tailwind par défaut", pattern: new RegExp(`\\b(?:${PALETTES})-\\d{2,3}\\b`, "g") },
  { name: "valeur arbitraire de couleur", pattern: /-\[(?:#|rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color:)/g },
  { name: "couleur nommée arbitraire", pattern: new RegExp(`-\\[(?:${NAMED_COLORS})\\]`, "g") },
];

/** Fragments de `source` qui sont des couleurs en dur (liste vide si le code est propre). */
export function findHardcodedColors(source: string): string[] {
  return RULES.flatMap(({ name, pattern }) =>
    [...source.matchAll(pattern)].map((match) => `${match[0]} (${name})`),
  );
}
