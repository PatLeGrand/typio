export const BLOB_COLORS = [
  "sky",
  "mint",
  "coral",
  "sun",
  "lavender",
  "berry",
  "tangerine",
  "lime",
  "indigo",
  "peach",
  "slate",
  "cream",
] as const;
export type BlobColor = (typeof BLOB_COLORS)[number];

export const BLOB_EXPRESSIONS = [
  "smile",
  "wink",
  "determined",
  "surprised",
  "cat",
  "cool",
] as const;
export type BlobExpression = (typeof BLOB_EXPRESSIONS)[number];

export const BLOB_GLASSES = [
  "none",
  "round",
  "shades",
  "star",
  "heart",
  "pixel",
  "monocle",
  "visor",
] as const;
export type BlobGlasses = (typeof BLOB_GLASSES)[number];

export const BLOB_HATS = [
  "none",
  "cap",
  "beanie",
  "crown",
  "tophat",
  "headphones",
  "beret",
  "party",
] as const;
export type BlobHat = (typeof BLOB_HATS)[number];

export const BLOB_ACCESSORIES = [
  "none",
  "bowtie",
  "scarf",
  "blush",
  "mustache",
  "cape",
  "wings",
  "bandaid",
] as const;
export type BlobAccessory = (typeof BLOB_ACCESSORIES)[number];

export type BlobStyle = {
  color: BlobColor;
  expression: BlobExpression;
  glasses: BlobGlasses;
  hat: BlobHat;
  accessory: BlobAccessory;
};

/** Style d'origine du Blob de course (bleu ciel `#54B7E5`, sourire classique, sans accessoires). */
export const DEFAULT_BLOB_STYLE: BlobStyle = {
  color: "sky",
  expression: "smile",
  glasses: "none",
  hat: "none",
  accessory: "none",
};

/** Couleur de remplissage du corps pour chaque option (`sky` = couleur exacte de `public/race/blob.svg`). */
export const BLOB_COLOR_HEX: Readonly<Record<BlobColor, string>> = {
  sky: "#54B7E5",
  mint: "#4CD4A9",
  coral: "#FF856D",
  sun: "#FFD24C",
  lavender: "#A682FF",
  berry: "#F26BA8",
  tangerine: "#FF9F43",
  lime: "#8BE04E",
  indigo: "#5B6EE1",
  peach: "#FFB5A7",
  slate: "#6C8499",
  cream: "#F4EBD0",
};

const COLOR_SET = new Set<string>(BLOB_COLORS);
const EXPRESSION_SET = new Set<string>(BLOB_EXPRESSIONS);
const GLASSES_SET = new Set<string>(BLOB_GLASSES);
const HAT_SET = new Set<string>(BLOB_HATS);
const ACCESSORY_SET = new Set<string>(BLOB_ACCESSORIES);

export function isBlobColor(value: unknown): value is BlobColor {
  return typeof value === "string" && COLOR_SET.has(value);
}

export function isBlobExpression(value: unknown): value is BlobExpression {
  return typeof value === "string" && EXPRESSION_SET.has(value);
}

export function isBlobGlasses(value: unknown): value is BlobGlasses {
  return typeof value === "string" && GLASSES_SET.has(value);
}

export function isBlobHat(value: unknown): value is BlobHat {
  return typeof value === "string" && HAT_SET.has(value);
}

export function isBlobAccessory(value: unknown): value is BlobAccessory {
  return typeof value === "string" && ACCESSORY_SET.has(value);
}

/**
 * Valide et normalise un style de blob ; renvoie `null` si une valeur est invalide.
 * Les champs ajoutés ultérieurement (`expression`, `accessory`) prennent leur valeur par défaut
 * lorsqu'ils sont absents afin de préserver les styles déjà enregistrés en base.
 */
export function parseBlobStyle(value: unknown): BlobStyle | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isBlobColor(record.color) || !isBlobGlasses(record.glasses) || !isBlobHat(record.hat)) {
    return null;
  }

  const expression =
    record.expression === undefined ? DEFAULT_BLOB_STYLE.expression : record.expression;
  if (!isBlobExpression(expression)) {
    return null;
  }

  const accessory =
    record.accessory === undefined ? DEFAULT_BLOB_STYLE.accessory : record.accessory;
  if (!isBlobAccessory(accessory)) {
    return null;
  }

  return {
    color: record.color,
    expression,
    glasses: record.glasses,
    hat: record.hat,
    accessory,
  };
}

export function blobStyleEquals(a: BlobStyle, b: BlobStyle): boolean {
  return (
    a.color === b.color &&
    a.expression === b.expression &&
    a.glasses === b.glasses &&
    a.hat === b.hat &&
    a.accessory === b.accessory
  );
}

export function blobStyleKey(style: BlobStyle): string {
  return `${style.color}:${style.expression}:${style.glasses}:${style.hat}:${style.accessory}`;
}

export function randomBlobStyle(rng: () => number = Math.random): BlobStyle {
  const pick = <T,>(items: readonly T[]): T =>
    items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  return {
    color: pick(BLOB_COLORS),
    expression: pick(BLOB_EXPRESSIONS),
    glasses: pick(BLOB_GLASSES),
    hat: pick(BLOB_HATS),
    accessory: pick(BLOB_ACCESSORIES),
  };
}
