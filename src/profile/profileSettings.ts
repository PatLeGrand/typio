import { validatePseudo } from "@/auth/validation";
import { isLocale, type Locale } from "@/i18n/config";

/** Valeurs de la colonne `users.keyboard_layout` (contrainte `users_keyboard_layout_check`). */
export const KEYBOARD_LAYOUTS = ["qwerty", "azerty", "cmf"] as const;

export type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number];

export function isKeyboardLayout(value: unknown): value is KeyboardLayout {
  return typeof value === "string" && (KEYBOARD_LAYOUTS as readonly string[]).includes(value);
}

/**
 * Codes d'erreur de la modification du profil ; l'interface les traduit (UI-5), jamais de
 * phrase ici. `INVALID_PSEUDO`, `PSEUDO_TAKEN` et `UNKNOWN` réutilisent les messages de
 * l'authentification (`auth.errors`), les autres vivent dans `profile.errors`.
 */
export const PROFILE_ERROR_CODES = [
  "INVALID_PSEUDO",
  "PSEUDO_TAKEN",
  "INVALID_SETTINGS",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "UNKNOWN",
] as const;

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[number];

export type ProfileUpdateResult = { ok: true; locale: Locale } | { ok: false; code: ProfileErrorCode };

export interface ProfileUpdate {
  displayName: string;
  keyboardLayout: KeyboardLayout;
  locale: Locale;
}

export type ProfileValidationResult = { ok: true; value: ProfileUpdate } | { ok: false; code: ProfileErrorCode };

/** Valide les trois réglages éditables du profil ; le nom affiché suit la règle du pseudo (AUTH-4). */
export function validateProfileUpdate(raw: {
  displayName: unknown;
  keyboardLayout: unknown;
  locale: unknown;
}): ProfileValidationResult {
  const pseudo = validatePseudo(raw.displayName);
  if (!pseudo.ok) return { ok: false, code: "INVALID_PSEUDO" };
  if (!isKeyboardLayout(raw.keyboardLayout) || !isLocale(raw.locale)) {
    return { ok: false, code: "INVALID_SETTINGS" };
  }
  return { ok: true, value: { displayName: pseudo.value, keyboardLayout: raw.keyboardLayout, locale: raw.locale } };
}
