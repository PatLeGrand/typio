import { createHash } from "node:crypto";

/** 32 octets d'aléa, soit 256 bits : hors de portée d'une énumération. */
const TOKEN_BYTES = 32;

/** 32 octets en base64url sans bourrage : 43 caractères. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Nouveau jeton de session, à placer dans le cookie. Seul son SHA-256 (`hashToken`)
 * va en base ; le jeton brut n'est ni stocké ni journalisé.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** Identifiant de session en base : SHA-256 hexadécimal du jeton. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Vrai si la valeur a la forme d'un jeton émis par `generateToken`. Écarte les cookies
 * forgés ou tronqués avant tout accès à la base. Réutilisé par le service temps réel.
 */
export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
