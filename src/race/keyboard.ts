import type { Locale } from "@/i18n/config";
import type { KeyboardLayout } from "@/profile/profileSettings";

const LAYOUTS: Record<KeyboardLayout, readonly (readonly string[])[]> = {
  azerty: [
    ["²", "&1", "é2~", '\"3#', "'4{", "(5[", "-6|", "è7`", "_8\\", "ç9", "à0@", ")°]", "=+}"],
    ["a", "z", "e€", "r", "t", "y", "u", "i", "o", "p", "^¨", "$£¤"],
    ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m", "ù%", "*µ"],
    ["<>", "w", "x", "c", "v", "b", "n", ",?", ";.", ":/", "!§"],
    [" "],
  ],
  qwerty: [
    ["`~", "1!", "2@", "3#", "4$", "5%", "6^", "7&", "8*", "9(", "0)", "-_", "=+"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[{", "]}", "\\|"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";:", "'\""],
    ["z", "x", "c", "v", "b", "n", "m", ",<", ".>", "/?"],
    [" "],
  ],
  cmf: [
    ["/\\|", "1!±", "2@@", "3#£", "4$¢", "5%¤", "6?¬", "7&¦", "8*²", "9(³", "0)¼", "-_½", "=+¾"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "^¨[", "ç~]"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";:", "è`{", "à°}"],
    ["ù«»", "z", "x", "c", "v", "b", "n", "m", ",'", ".\"", "éÉ"],
    [" "],
  ],
};

/** Regroupe les caractères sur leur touche physique ; conserve les autres à part. */
export function placeMissedKeys(
  missedKeys: Record<string, number>,
  locale: Locale,
  layout?: KeyboardLayout,
) {
  const resolvedLayout: KeyboardLayout = layout ?? (locale === "fr" ? "azerty" : "qwerty");
  const rows = LAYOUTS[resolvedLayout].map((row) => row.map((characters) => ({ characters, key: characters[0], count: 0 })));
  const keys = rows.flat();
  const other: { key: string; count: number }[] = [];
  for (const [character, count] of Object.entries(missedKeys)) {
    const key = character.toLowerCase();
    const placed = keys.find((entry) => entry.key === key) ?? keys.find((entry) => entry.characters.includes(key));
    if (placed) placed.count += count;
    else {
      const existing = other.find((entry) => entry.key === key);
      if (existing) existing.count += count;
      else other.push({ key, count });
    }
  }
  const mostMissed = [...keys, ...other].filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
  return { rows, other, mostMissed, max: mostMissed[0]?.count ?? 0, layout: resolvedLayout };
}
