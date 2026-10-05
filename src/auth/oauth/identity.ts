import { validatePseudo } from "../validation";

/** Longueur maximale de la base d'un identifiant : 16 + `_` + 3 chiffres = 20 (limite de `users.username`). */
const USERNAME_BASE_MAX_LENGTH = 16;
const USERNAME_MIN_LENGTH = 3;
const FALLBACK_USERNAME = "joueur";
const PSEUDO_MAX_LENGTH = 20;

/** Nombre d'essais d'identifiant avant d'abandonner : le nom de base, puis 4 suffixes aléatoires. */
export const USERNAME_ATTEMPTS = 5;

/**
 * Identifiant proposé à partir du login du fournisseur : minuscules sans accents, tout
 * caractère hors `[a-z0-9_]` remplacé par `_` (« jean-luc » donne `jean_luc`), `_` de bord
 * retirés, 16 caractères au plus, au moins 3 (sinon `joueur`).
 */
export function deriveUsernameBase(login: string): string {
  const base = login
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_BASE_MAX_LENGTH)
    .replace(/_+$/g, "");
  return base.length >= USERNAME_MIN_LENGTH ? base : FALLBACK_USERNAME;
}

/**
 * Identifiant du n-ième essai : la base au premier, puis la base suivie de `_` et de 3
 * chiffres aléatoires. `randomThreeDigits` est injectable pour les tests.
 */
export function usernameForAttempt(
  base: string,
  attempt: number,
  randomThreeDigits: () => string = defaultRandomThreeDigits,
): string {
  return attempt === 0 ? base : `${base}_${randomThreeDigits()}`;
}

function defaultRandomThreeDigits(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000).padStart(3, "0");
}

/**
 * Nom d'affichage proposé : le nom du fournisseur, débarrassé des caractères que la
 * validation de pseudo refuse, ramené à 20 caractères, puis revalidé ; à défaut, `fallback`
 * (l'identifiant). Le résultat respecte donc les mêmes règles qu'un pseudo saisi à la main.
 */
export function deriveDisplayName(providerName: string | null, fallback: string): string {
  if (providerName === null) return fallback;
  const cleaned = Array.from(
    providerName
      .normalize("NFC")
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .replace(/ +/g, " ")
      .trim(),
  )
    .slice(0, PSEUDO_MAX_LENGTH)
    .join("")
    .trim();
  const pseudo = validatePseudo(cleaned);
  return pseudo.ok ? pseudo.value : fallback;
}
