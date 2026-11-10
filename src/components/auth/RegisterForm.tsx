"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Lock, User } from "lucide-react";
import { validateUsername, validateNewPassword } from "@/auth/validation";
import { register } from "@/auth/actions";
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

type RegisterFormProps = {
  locale: Locale;
  labels: Dictionary["register"];
  common: Dictionary["auth"];
};

const IDLE: AuthFormState = { status: "idle" };
const FORM_FIELDS: readonly AuthField[] = ["username", "password", "passwordConfirm", "terms"];
const FIELD_IDS = {
  username: "register-username",
  password: "register-password",
  passwordConfirm: "register-password-confirm",
  terms: "register-terms",
} as const;
const PSEUDO_HINT_ID = "register-username-hint";
const PASSWORD_RULE_ID = "register-password-rule";
const TERMS_ERROR_ID = "register-terms-error";

/** Inscription par pseudo et mot de passe (AUTH-01, TEST-03), sans e-mail. La validation fait foi côté serveur. */
export function RegisterForm({ locale, labels, common }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(register, IDLE);
  // Les valeurs restent uniquement côté client après une erreur de l’action.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [clientErrors, setClientErrors] = useState<Partial<Record<AuthField, string>> | null>(null);
  const [terms, setTerms] = useState(false);

  const errors = clientErrors ? { fieldErrors: clientErrors } : getAuthErrorView(state, common.errors, FORM_FIELDS);
  useFocusOnError(state, FIELD_IDS);
  useEffect(() => {
    const first = FORM_FIELDS.find((field) => clientErrors?.[field]);
    if (first) document.getElementById(FIELD_IDS[first as keyof typeof FIELD_IDS])?.focus();
  }, [clientErrors]);

  function validate(event: FormEvent<HTMLFormElement>) {
    const fieldErrors: Partial<Record<AuthField, string>> = {};
    const validUsername = validateUsername(username);
    const validPassword = validateNewPassword(password);
    if (!validUsername.ok) fieldErrors.username = common.errors[validUsername.code];
    if (!validPassword.ok) fieldErrors.password = common.errors[validPassword.code];
    if (!passwordConfirm || passwordConfirm !== password) fieldErrors.passwordConfirm = common.errors.PASSWORD_MISMATCH;
    if (!terms) fieldErrors.terms = common.errors.TERMS_REQUIRED;
    const first = FORM_FIELDS.find((field) => fieldErrors[field]);
    setClientErrors(first ? fieldErrors : null);
    if (first) {
      event.preventDefault();
    }
  }

  const privacyHref = `/${locale}/privacy`;

  return (
    <form action={formAction} onSubmit={validate} noValidate className="flex flex-col gap-5">
      <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
      <div className="flex flex-col gap-2">
        <TextField
          id={FIELD_IDS.username}
          name={AUTH_FIELDS.username}
          label={labels.pseudoLabel}
          placeholder={labels.pseudoPlaceholder}
          icon={<User />}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={PSEUDO_HINT_ID}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors.fieldErrors.username}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            id={FIELD_IDS.password}
            name={AUTH_FIELDS.password}
            label={labels.passwordLabel}
            placeholder={labels.passwordPlaceholder}
            icon={<Lock />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            aria-describedby={PASSWORD_RULE_ID}
            showLabel={common.showPassword}
            hideLabel={common.hidePassword}
            error={errors.fieldErrors.password}
          />
          <PasswordField
            id={FIELD_IDS.passwordConfirm}
            name={AUTH_FIELDS.passwordConfirm}
            label={labels.confirmLabel}
            placeholder={labels.confirmPlaceholder}
            icon={<Lock />}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            autoComplete="new-password"
            required
            showLabel={common.showPassword}
            hideLabel={common.hidePassword}
            error={errors.fieldErrors.passwordConfirm}
          />
        </div>
        <p id={PASSWORD_RULE_ID} className="text-xs text-muted">
          {labels.passwordRule}
        </p>
      </div>
      <div className="flex flex-col">
        <Checkbox
          id={FIELD_IDS.terms}
          name={AUTH_FIELDS.terms}
          defaultChecked={terms}
          onChange={(event) => setTerms(event.target.checked)}
          required
          aria-invalid={errors.fieldErrors.terms ? true : undefined}
          aria-describedby={errors.fieldErrors.terms ? TERMS_ERROR_ID : undefined}
          label={
            <span className="leading-snug">
              {labels.termsBefore}
              {/* Nouvel onglet : la saisie du formulaire n'est pas perdue. La mention est lue par les lecteurs d'écran. */}
              <Link
                href={privacyHref}
                target="_blank"
                rel="noopener"
                className="font-semibold text-accent-text underline-offset-2 hover:underline"
              >
                {labels.privacyLink}
                <span className="sr-only"> {labels.newTab}</span>
              </Link>
              {labels.termsAfter}
            </span>
          }
        />
        {errors.fieldErrors.terms ? (
          <p id={TERMS_ERROR_ID} className="text-[13px] font-semibold text-danger">
            {errors.fieldErrors.terms}
          </p>
        ) : null}
      </div>
      {errors.general ? <FormAlert>{errors.general}</FormAlert> : null}
      <AuthSubmitButton label={labels.submit} enterKeyLabel={common.enterKey} pending={pending} />
    </form>
  );
}
