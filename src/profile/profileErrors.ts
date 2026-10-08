import type { Dictionary } from "@/i18n/dictionaries";
import type { ProfileErrorCode } from "./profileSettings";

/**
 * Message traduit d'un code d'erreur du profil. Les codes communs avec l'authentification
 * réutilisent `auth.errors` pour ne pas dupliquer les phrases.
 */
export function profileErrorMessage(code: ProfileErrorCode, dictionary: Dictionary): string {
  switch (code) {
    case "INVALID_PSEUDO":
    case "PSEUDO_TAKEN":
    case "RATE_LIMITED":
    case "UNKNOWN":
      return dictionary.auth.errors[code];
    case "INVALID_SETTINGS":
    case "UNAUTHORIZED":
      return dictionary.profile.errors[code];
  }
}
