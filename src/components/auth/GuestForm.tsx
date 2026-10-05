"use client";

import { useActionState, useState } from "react";
import { User } from "lucide-react";
import { continueAsGuest } from "@/auth/actions";
import { AUTH_FIELDS, type AuthField, type AuthFormState } from "@/auth/types";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { TextField } from "../TextField";
import { getAuthErrorView } from "./authErrors";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { FormAlert } from "./FormAlert";
import { useFocusOnError } from "./useFocusOnError";

type GuestFormProps = {
  locale: Locale;
  labels: Dictionary["guest"];
  common: Dictionary["auth"];
};

const IDLE: AuthFormState = { status: "idle" };
const FORM_FIELDS: readonly AuthField[] = ["pseudo"];
const FIELD_IDS = { pseudo: "guest-pseudo" } as const;
const HINT_ID = "guest-pseudo-hint";

/** Jeu en invité avec un simple pseudo (AUTH-4). */
export function GuestForm({ locale, labels, common }: GuestFormProps) {
  const [state, formAction, pending] = useActionState(continueAsGuest, IDLE);
  // Contrôlé : React 19 vide les champs non contrôlés après une action, erreur comprise.
  const [pseudo, setPseudo] = useState("");

  const errors = getAuthErrorView(state, common.errors, FORM_FIELDS);
  useFocusOnError(state, FIELD_IDS);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
      <div className="flex flex-col gap-2">
        <TextField
          id={FIELD_IDS.pseudo}
          name={AUTH_FIELDS.pseudo}
          label={labels.pseudoLabel}
          placeholder={labels.pseudoPlaceholder}
          icon={<User />}
          autoComplete="nickname"
          spellCheck={false}
          required
          aria-describedby={HINT_ID}
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          error={errors.fieldErrors.pseudo}
        />
        <p id={HINT_ID} className="text-xs text-muted">
          {labels.pseudoHint}
        </p>
      </div>
      {errors.general ? <FormAlert>{errors.general}</FormAlert> : null}
      <AuthSubmitButton label={labels.submit} enterKeyLabel={common.enterKey} pending={pending} />
    </form>
  );
}
