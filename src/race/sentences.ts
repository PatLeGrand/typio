import type { RaceSettings } from "./config";

/** Nombre de textes à taper selon la longueur choisie. */
const TEXT_COUNT: Record<RaceSettings["length"], number> = { short: 3, medium: 5, long: 8 };

/** Réserve locale de phrases : en attendant une vraie source de textes. Ordre fixe (pas d'aléatoire au rendu). */
const SENTENCES: Record<RaceSettings["language"], readonly string[]> = {
  fr: [
    "Le petit blob rebondit joyeusement sur la piste ensoleillée.",
    "Chaque lettre bien tapée fait avancer ton blob un peu plus vite.",
    "Un vent léger pousse les nuages au-dessus de la prairie verte.",
    "Garde ton calme, respire, et laisse tes doigts danser sur le clavier.",
    "Les blobs colorés se disputent la première place avec beaucoup d'élan.",
    "La ligne d'arrivée approche, il ne faut surtout pas relâcher l'effort.",
    "Même le plus lent des blobs finit toujours par franchir la ligne.",
    "Tape vite, tape juste, et profite de la course jusqu'au bout.",
  ],
  en: [
    "The quick wobbly blob jumps over the lazy, bouncy, silly platforms.",
    "Every correct letter makes your blob bounce a little faster.",
    "A gentle breeze pushes the clouds across the green meadow.",
    "Stay calm, breathe in, and let your fingers dance on the keyboard.",
    "The colorful blobs fight for first place with plenty of spring.",
    "The finish line is getting closer, so keep up the pace.",
    "Even the slowest blob always reaches the finish line in the end.",
    "Type fast, type right, and enjoy the race until the very end.",
  ],
};

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/**
 * Textes de la course, d'après les réglages : langue, accents, caractères exclus, mode et longueur.
 * Ne renvoie jamais de caractère exclu : si aucune phrase n'est compatible, on les retire des phrases.
 */
export function buildRaceTexts(settings: RaceSettings): string[] {
  const excluded = new Set(Array.from(settings.excludedCharacters.toLowerCase()));
  const base = SENTENCES[settings.language].map((sentence) => (settings.accents ? sentence : stripAccents(sentence)));
  const isAllowed = (text: string) => Array.from(text.toLowerCase()).every((char) => !excluded.has(char));

  let pool = base.filter(isAllowed);
  if (pool.length === 0) {
    pool = base.map((text) => Array.from(text).filter((char) => !excluded.has(char.toLowerCase())).join("").replace(/\s+/g, " ").trim());
    pool = pool.filter((text) => text.length > 0);
  }
  if (settings.textMode === "words") {
    pool = pool
      .map((text) => text.toLowerCase().replace(/[.,;:!?]/g, "").split(/\s+/).slice(0, 4).join(" "))
      .filter((text) => text.length > 0);
  }
  return pool.slice(0, TEXT_COUNT[settings.length]);
}
