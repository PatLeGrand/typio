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
  returnTo?: string;
};

const IDLE: AuthFormState = { status: "idle" };
const FORM_FIELDS: readonly AuthField[] = ["pseudo"];
const FIELD_IDS = { pseudo: "guest-pseudo" } as const;

/** Jeu en invité avec un simple pseudo (AUTH-02, AUTH-03). */
export function GuestForm({ locale, labels, common, returnTo }: GuestFormProps) {
  const [state, formAction, pending] = useActionState(continueAsGuest, IDLE);
  // Contrôlé : React 19 vide les champs non contrôlés après une action, erreur comprise.
  const [pseudo, setPseudo] = useState("");

  const errors = getAuthErrorView(state, common.errors, FORM_FIELDS);
  useFocusOnError(state, FIELD_IDS);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
      {returnTo ? <input type="hidden" name={AUTH_FIELDS.returnTo} value={returnTo} /> : null}
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
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          error={errors.fieldErrors.pseudo}
        />
      </div>
      {errors.general ? <FormAlert>{errors.general}</FormAlert> : null}
      <AuthSubmitButton label={labels.submit} enterKeyLabel={common.enterKey} pending={pending} />
    </form>
  );
}
