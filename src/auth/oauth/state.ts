import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compare le `state` reçu à celui du cookie en temps constant. Les deux valeurs sont d'abord
 * condensées en SHA-256 : `timingSafeEqual` exige des longueurs égales, et la longueur de la
 * valeur attendue ne fuit pas. Une valeur absente ou vide ne correspond jamais.
 */
export function statesMatch(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expected), digest(received));
}
