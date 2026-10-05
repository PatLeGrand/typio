import type { Locale } from "@/i18n/config";

export type UserKind = "member" | "guest";

/** Codes d'erreur rendus aux formulaires ; l'interface les traduit (UI-5), jamais de phrase ici. */
export type AuthErrorCode =
  | "INVALID_USERNAME"
  | "INVALID_PASSWORD"
  | "INVALID_PSEUDO"
  | "USERNAME_TAKEN"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "UNKNOWN";

export type AuthField = "username" | "password" | "pseudo";

/** État renvoyé par les Server Actions, branché sur `useActionState`. */
export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; code: AuthErrorCode; field?: AuthField };

/** Utilisateur authentifié tel que l'exposent `getCurrentUser()` et le futur service temps réel. */
export interface CurrentUser {
  id: string;
  kind: UserKind;
  displayName: string;
  username: string | null;
  locale: Locale;
}

/**
 * Noms des champs des formulaires d'authentification, partagés entre les Server Actions
 * et les formulaires qui les envoient.
 */
export const AUTH_FIELDS = {
  username: "username",
  password: "password",
  /** Case « rester connecté » : `"on"` quand cochée, absente sinon. */
  remember: "remember",
  pseudo: "pseudo",
  /** Champ caché : langue de l'interface (`fr` ou `en`). */
  locale: "locale",
} as const;

export interface AuthFailure {
  code: AuthErrorCode;
  field?: AuthField;
}
