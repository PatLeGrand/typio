import type { AuthErrorCode, AuthField, AuthFormState } from "@/auth/types";

/** Messages traduits, un par code d'erreur (`Dictionary["auth"]["errors"]`). */
export type AuthErrorMessages = Record<AuthErrorCode, string>;

export interface AuthErrorView {
  /** Message à afficher sous le champ fautif (propriété `error` des champs). */
  fieldErrors: Partial<Record<AuthField, string>>;
  /** Message général (`role="alert"`) : erreur sans champ, ou dont le champ est absent du formulaire. */
  general?: string;
}

/**
 * Traduit l'état d'une Server Action en messages affichables, au bon endroit : sous le champ
 * quand le serveur en désigne un que ce formulaire possède, sinon en message général.
 */
export function getAuthErrorView(
  state: AuthFormState,
  messages: AuthErrorMessages,
  formFields: readonly AuthField[],
): AuthErrorView {
  if (state.status !== "error") return { fieldErrors: {} };

  const message = messages[state.code];
  if (state.field !== undefined && formFields.includes(state.field)) {
    return { fieldErrors: { [state.field]: message } };
  }
  return { fieldErrors: {}, general: message };
}
