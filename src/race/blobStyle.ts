export const BLOB_COLORS = ["sky", "mint", "coral", "sun", "lavender", "berry"] as const;
export type BlobColor = (typeof BLOB_COLORS)[number];

export const BLOB_GLASSES = ["none", "round", "shades", "star"] as const;
export type BlobGlasses = (typeof BLOB_GLASSES)[number];

export const BLOB_HATS = ["none", "cap", "beanie", "crown"] as const;
export type BlobHat = (typeof BLOB_HATS)[number];

export type BlobStyle = {
  color: BlobColor;
  glasses: BlobGlasses;
  hat: BlobHat;
};

/** Style d'origine du Blob de course (bleu ciel `#54B7E5`, sans accessoires). */
export const DEFAULT_BLOB_STYLE: BlobStyle = {
  color: "sky",
  glasses: "none",
  hat: "none",
};

/** Couleur de remplissage du corps pour chaque option (`sky` = couleur exacte de `public/race/blob.svg`). */
export const BLOB_COLOR_HEX: Readonly<Record<BlobColor, string>> = {
  sky: "#54B7E5",
  mint: "#4CD4A9",
  coral: "#FF856D",
  sun: "#FFD24C",
  lavender: "#A682FF",
  berry: "#F26BA8",
};

const COLOR_SET = new Set<string>(BLOB_COLORS);
const GLASSES_SET = new Set<string>(BLOB_GLASSES);
const HAT_SET = new Set<string>(BLOB_HATS);

export function isBlobColor(value: unknown): value is BlobColor {
  return typeof value === "string" && COLOR_SET.has(value);
}

export function isBlobGlasses(value: unknown): value is BlobGlasses {
  return typeof value === "string" && GLASSES_SET.has(value);
}

export function isBlobHat(value: unknown): value is BlobHat {
  return typeof value === "string" && HAT_SET.has(value);
}

/** Valide et normalise un style de blob ; renvoie `null` si une valeur manque ou est invalide. */
export function parseBlobStyle(value: unknown): BlobStyle | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isBlobColor(record.color) || !isBlobGlasses(record.glasses) || !isBlobHat(record.hat)) {
    return null;
  }
  return {
    color: record.color,
    glasses: record.glasses,
    hat: record.hat,
  };
}

export function blobStyleEquals(a: BlobStyle, b: BlobStyle): boolean {
  return a.color === b.color && a.glasses === b.glasses && a.hat === b.hat;
}

export function blobStyleKey(style: BlobStyle): string {
  return `${style.color}:${style.glasses}:${style.hat}`;
}
