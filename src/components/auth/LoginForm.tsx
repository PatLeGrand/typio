"use client";

import { useActionState, useState } from "react";
import { Lock, User } from "lucide-react";
import { login } from "@/auth/actions";
import { AUTH_FIELDS, type AuthField, type AuthFormState } from "@/auth/types";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Checkbox } from "../Checkbox";
import { PasswordField } from "../PasswordField";
import { TextField } from "../TextField";
import { getAuthErrorView } from "./authErrors";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { FormAlert } from "./FormAlert";
import { useFocusOnError } from "./useFocusOnError";

type LoginFormProps = {
  locale: Locale;
  labels: Dictionary["login"];
  common: Dictionary["auth"];
};

const IDLE: AuthFormState = { status: "idle" };
const FORM_FIELDS: readonly AuthField[] = ["username", "password"];
const FIELD_IDS = { username: "login-username", password: "login-password" } as const;

/** Connexion par identifiant et mot de passe (AUTH-1). */
export function LoginForm({ locale, labels, common }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, IDLE);
  // React 19 vide les champs non contrôlés après une action : l'identifiant et la case sont
  // donc suivis dans l'état pour survivre à une erreur. Le mot de passe, lui, est volontairement
  // vidé. La case utilise `defaultChecked` (et non `checked`) : le reset du formulaire la remet
  // à sa valeur par défaut, qui doit donc suivre l'état.
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(false);

  const errors = getAuthErrorView(state, common.errors, FORM_FIELDS);
  useFocusOnError(state, FIELD_IDS);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
      <TextField
        id={FIELD_IDS.username}
        name={AUTH_FIELDS.username}
        label={labels.usernameLabel}
        placeholder={labels.usernamePlaceholder}
        icon={<User />}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        error={errors.fieldErrors.username}
      />
      <PasswordField
        id={FIELD_IDS.password}
        name={AUTH_FIELDS.password}
        label={common.passwordLabel}
        placeholder={common.passwordPlaceholder}
        icon={<Lock />}
        autoComplete="current-password"
        required
        showLabel={common.showPassword}
        hideLabel={common.hidePassword}
        error={errors.fieldErrors.password}
      />
      <Checkbox
        name={AUTH_FIELDS.remember}
        label={labels.remember}
        defaultChecked={remember}
        onChange={(event) => setRemember(event.target.checked)}
      />
      {errors.general ? <FormAlert>{errors.general}</FormAlert> : null}
      <AuthSubmitButton label={labels.submit} enterKeyLabel={common.enterKey} pending={pending} />
    </form>
  );
}
