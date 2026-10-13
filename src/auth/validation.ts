import type { AuthErrorCode } from "./types";

const PASSWORD_MIN_LENGTH = 8;
/** La borne haute protège argon2 : le coût de hachage ne doit pas dépendre d'un envoi géant. */
const PASSWORD_MAX_LENGTH = 128;
const PSEUDO_MIN_LENGTH = 2;
/** Exporté pour le compteur « n / 20 » du profil. */
export const PSEUDO_MAX_LENGTH = 20;

/**
 * Testé sur la saisie rognée AVANT passage en minuscules : `toLowerCase()` transforme
 * certains caractères non ASCII en lettres ASCII (le signe Kelvin U+212A donne `k`), ce
 * qui ferait passer des identifiants visuellement trompeurs.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
/**
 * AUTH-4 : un pseudo ne s'écrit qu'en alphabet latin, pour qu'aucun homoglyphe (« а »
 * cyrillique, « ο » grec, « ａ » pleine chasse, « ɑ » latin alpha) ne puisse imiter
 * l'identifiant ASCII d'un membre. Sont admis : l'ASCII ci-dessous, les lettres dont la
 * forme NFD est une lettre ASCII suivie de diacritiques (« é », « ï », « ç »), et les
 * ligatures de `PSEUDO_LIGATURES`. Tout le reste (autres scripts, chiffres non ASCII,
 * caractères invisibles ou de mise en forme, emoji) est refusé.
 */
const ASCII_PSEUDO_CHARACTER = /^[A-Za-z0-9 _-]$/;
const ASCII_LETTER = /^[A-Za-z]$/;
/** Diacritiques combinants (U+0300 à U+036F), ceux qu'utilisent les lettres accentuées. */
const DIACRITICS = /[\u0300-\u036f]/g;
const ONLY_DIACRITICS = /^[\u0300-\u036f]+$/;
/** Ligatures françaises, sans décomposition NFD, avec leur équivalent ASCII pour le squelette. */
const PSEUDO_LIGATURES = new Map([
  ["æ", "ae"],
  ["Æ", "ae"],
  ["œ", "oe"],
  ["Œ", "oe"],
]);
const VISIBLE_PSEUDO_CHARACTER = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

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

function isPseudoCharacter(character: string): boolean {
  if (ASCII_PSEUDO_CHARACTER.test(character) || PSEUDO_LIGATURES.has(character)) return true;
  const [base, ...marks] = Array.from(character.normalize("NFD"));
  return ASCII_LETTER.test(base) && ONLY_DIACRITICS.test(marks.join(""));
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

/**
 * Règle appliquée à l'INSCRIPTION seulement : en plus des bornes de `validatePassword`, au
 * moins une lettre et un chiffre (Unicode). La connexion garde `validatePassword`, pour que
 * les comptes créés avant cette règle puissent toujours se connecter.
 */
export function validateNewPassword(raw: unknown): ValidationResult<string> {
  const result = validatePassword(raw);
  if (!result.ok) return result;
  if (!LETTER.test(result.value) || !DIGIT.test(result.value)) {
    return { ok: false, code: "INVALID_PASSWORD" };
  }
  return result;
}

export function validatePseudo(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, code: "INVALID_PSEUDO" };
  const pseudo = raw.trim().normalize("NFC");
  const size = length(pseudo);
  if (
    size < PSEUDO_MIN_LENGTH ||
    size > PSEUDO_MAX_LENGTH ||
    !Array.from(pseudo).every(isPseudoCharacter) ||
    !VISIBLE_PSEUDO_CHARACTER.test(pseudo)
  ) {
    return { ok: false, code: "INVALID_PSEUDO" };
  }
  return { ok: true, value: pseudo };
}

/**
 * Pliage des confusables ASCII, sur une chaîne DÉJÀ en minuscules : `i`, `1` et `|` valent `l`
 * (un « I » majuscule se lit `i` ou `l`), `0` vaut `o`, puis `rn` vaut `m`, puis `w` est déplié
 * en `vv` (le sens `vv` vers `w` n'est pas canonique : `vvv` se lit `vw` ou `wv`). Ordre fixe,
 * remplacements de gauche à droite sans chevauchement (`rnrn` donne `mm`), comme `replace()` de
 * PostgreSQL. Doit rester identique à l'expression SQL de `memberUsernameExists`. `|` n'est admis
 * nulle part aujourd'hui : il est plié par prudence si l'alphabet s'élargit. Coût accepté : `elia`
 * et `ella` ont le même squelette.
 */
export function foldAsciiConfusables(lowercase: string): string {
  return lowercase.replaceAll(/[i1|]/g, "l").replaceAll("0", "o").replaceAll("rn", "m").replaceAll("w", "vv");
}

/**
 * Squelette d'un identifiant de membre (déjà en ASCII) : minuscules puis pliage des confusables.
 * Miroir TypeScript exact de l'expression SQL de `memberUsernameExists`.
 */
export function usernameSkeleton(username: string): string {
  return foldAsciiConfusables(username.toLowerCase());
}

/**
 * Squelette d'un pseudo DÉJÀ validé par `validatePseudo` : diacritiques retirés, ligatures
 * dépliées, minuscules, confusables ASCII pliés. Le résultat est en ASCII, comparable à
 * `usernameSkeleton` d'un membre : « Àlice », « ALICÉ » et « a1ice » ne peuvent pas usurper le
 * membre `alice`, ni « AIice » (`i` et `l` sont fusionnés).
 */
export function pseudoSkeleton(pseudo: string): string {
  const withoutDiacritics = pseudo.normalize("NFD").replace(DIACRITICS, "");
  const unfolded = Array.from(withoutDiacritics, (character) => PSEUDO_LIGATURES.get(character) ?? character).join("");
  return foldAsciiConfusables(unfolded.toLowerCase());
}
