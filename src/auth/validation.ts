import type { AuthErrorCode } from "./types";

const PASSWORD_MIN_LENGTH = 8;
/** La borne haute protège argon2 : le coût de hachage ne doit pas dépendre d'un envoi géant. */
const PASSWORD_MAX_LENGTH = 128;
const PSEUDO_MIN_LENGTH = 2;
const PSEUDO_MAX_LENGTH = 20;

/**
 * Testé sur la saisie rognée AVANT passage en minuscules : `toLowerCase()` transforme
 * certains caractères non ASCII en lettres ASCII (le signe Kelvin U+212A donne `k`), ce
 * qui ferait passer des identifiants visuellement trompeurs.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
/** Lettres (accentuées comprises), chiffres, espace, `_` et `-`. */
const PSEUDO_PATTERN = /^[\p{L}\p{N} _-]+$/u;
/**
 * Caractères invisibles ou de mise en forme, refusés même s'ils sont rangés parmi les
 * lettres : les « fillers » Hangul (U+115F, U+1160, U+3164, U+FFA0) permettent un pseudo
 * qui paraît vide. Plus toute catégorie Cf (format), Cc (contrôle), Zl et Zp (séparateurs).
 */
const FORBIDDEN_PSEUDO_CHARACTERS = /[ᅟᅠㅤﾠ\p{Cf}\p{Cc}\p{Zl}\p{Zp}]/u;
const VISIBLE_PSEUDO_CHARACTER = /[\p{L}\p{N}]/u;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: AuthErrorCode };

export interface ValidUsername {
  /** Forme canonique (minuscules), clé d'unicité et de connexion. */
  username: string;
  /** Saisie rognée, casse d'origine : sert d'`display_name`. */
  displayName: string;
}

/** Longueur en caractères visibles (points de code), pas en unités UTF-16. */
function length(value: string): number {
  return Array.from(value).length;
}

export function validateUsername(raw: unknown): ValidationResult<ValidUsername> {
  if (typeof raw !== "string") return { ok: false, code: "INVALID_USERNAME" };
  const displayName = raw.trim();
  if (!USERNAME_PATTERN.test(displayName)) return { ok: false, code: "INVALID_USERNAME" };
  return { ok: true, value: { username: displayName.toLowerCase(), displayName } };
}

/** Le mot de passe n'est ni rogné ni modifié : les espaces en bord sont valides. */
export function validatePassword(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, code: "INVALID_PASSWORD" };
  const size = length(raw);
  if (size < PASSWORD_MIN_LENGTH || size > PASSWORD_MAX_LENGTH) {
    return { ok: false, code: "INVALID_PASSWORD" };
  }
  return { ok: true, value: raw };
}

export function validatePseudo(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, code: "INVALID_PSEUDO" };
  const pseudo = raw.trim().normalize("NFC");
  const size = length(pseudo);
  if (
    size < PSEUDO_MIN_LENGTH ||
    size > PSEUDO_MAX_LENGTH ||
    FORBIDDEN_PSEUDO_CHARACTERS.test(pseudo) ||
    !PSEUDO_PATTERN.test(pseudo) ||
    !VISIBLE_PSEUDO_CHARACTER.test(pseudo)
  ) {
    return { ok: false, code: "INVALID_PSEUDO" };
  }
  return { ok: true, value: pseudo };
}
