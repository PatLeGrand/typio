import type { Locale } from "@/i18n/config";

const LAYOUTS = {
  fr: [
    ["²", "&1", "é2~", '\"3#', "'4{", "(5[", "-6|", "è7`", "_8\\", "ç9", "à0@", ")°]", "=+}"],
    ["a", "z", "e€", "r", "t", "y", "u", "i", "o", "p", "^¨", "$£¤"],
    ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m", "ù%", "*µ"],
    ["<>", "w", "x", "c", "v", "b", "n", ",?", ";.", ":/", "!§"],
    [" "],
  ],
  en: [
    ["`~", "1!", "2@", "3#", "4$", "5%", "6^", "7&", "8*", "9(", "0)", "-_", "=+"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[{", "]}", "\\|"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";:", "'\""],
    ["z", "x", "c", "v", "b", "n", "m", ",<", ".>", "/?"],
    [" "],
  ],
};

/** Regroupe les caractères sur leur touche physique ; conserve les autres à part. */
export function placeMissedKeys(missedKeys: Record<string, number>, locale: Locale) {
  const rows = LAYOUTS[locale].map((row) => row.map((characters) => ({ characters, key: characters[0], count: 0 })));
  const keys = rows.flat();
  const other: { key: string; count: number }[] = [];
  for (const [character, count] of Object.entries(missedKeys)) {
    const key = character.toLowerCase();
    const placed = keys.find((entry) => entry.key === key) ?? keys.find((entry) => entry.characters.includes(key));
    if (placed) placed.count += count;
    else other.push({ key: character, count });
  }
  const mostMissed = [...keys, ...other].filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
  return { rows, other, mostMissed, max: mostMissed[0]?.count ?? 0 };
}
