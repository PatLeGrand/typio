/**
 * Codes de salle (SALLE-4, H-5) : 6 caractères, majuscules et chiffres, sans les
 * caractères ambigus 0, O, 1, I et L, pour qu'un code se dicte en classe sans erreur.
 * 31 symboles sur 6 positions : environ 887 millions de codes.
 */

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Au-delà, l'espace des codes est saturé ou le générateur est défaillant : on abandonne. */
const MAX_ATTEMPTS = 20;

/** Ce que l'élève a tapé, ramené à la forme canonique : sans espaces ni tirets, en majuscules. */
export function normalizeRoomCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value);
}

/**
 * Code aléatoire, tiré par `crypto.getRandomValues` : imprévisible, donc impossible à
 * deviner à partir des codes précédents. Rejet des octets ≥ 248 (8 × 31) pour que chaque
 * symbole ait exactement la même probabilité.
 */
export function generateRoomCode(random: (bytes: Uint8Array) => void = (b) => crypto.getRandomValues(b)): string {
  const limit = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;
  let code = "";
  const buffer = new Uint8Array(ROOM_CODE_LENGTH * 2);
  while (code.length < ROOM_CODE_LENGTH) {
    random(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue;
      code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }
  return code;
}

/** Code qui n'est pas déjà pris par une salle ouverte. Lève une erreur après MAX_ATTEMPTS collisions. */
export function generateUniqueRoomCode(
  isTaken: (code: string) => boolean,
  generate: () => string = generateRoomCode,
): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generate();
    if (!isTaken(code)) return code;
  }
  throw new Error("Unable to allocate a free room code");
}
