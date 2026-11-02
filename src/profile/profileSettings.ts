import { z } from "zod";
import { pseudoSchema } from "@/auth/validation";
import { locales, type Locale } from "@/i18n/config";

/** Valeurs de la colonne `users.keyboard_layout` (contrainte `users_keyboard_layout_check`). */
export const KEYBOARD_LAYOUTS = ["qwerty", "azerty", "cmf"] as const;

export type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number];

export function isKeyboardLayout(value: unknown): value is KeyboardLayout {
  return typeof value === "string" && (KEYBOARD_LAYOUTS as readonly string[]).includes(value);
}

/**
 * Codes d'erreur de la modification du profil ; l'interface les traduit (I18N-01, I18N-02, I18N-03), jamais de
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

export const profileUpdateSchema = z.object({
  displayName: pseudoSchema,
  keyboardLayout: z.enum(KEYBOARD_LAYOUTS),
  locale: z.enum(locales),
});

/** Valide les trois réglages éditables du profil ; le nom affiché suit la règle du pseudo (AUTH-02, AUTH-03). */
export function validateProfileUpdate(raw: {
  displayName?: unknown;
  keyboardLayout?: unknown;
  locale?: unknown;
}): ProfileValidationResult {
  const result = profileUpdateSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  // Le nom affiché prime : son erreur est rendue même si les autres réglages sont invalides aussi.
  const pseudoInvalid = result.error.issues.some((issue) => issue.path[0] === "displayName");
  return { ok: false, code: pseudoInvalid ? "INVALID_PSEUDO" : "INVALID_SETTINGS" };
}
