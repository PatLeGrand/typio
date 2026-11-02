"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import {
  createGuest,
  loginMember,
  registerMember,
  type AuthDeps,
  type AuthFlowResult,
} from "./authFlows";
import { getSessionCookieName, sessionCookieOptions } from "./cookie";
import { getAuthDeps } from "./deps";
import { describeError } from "./errors";
import { readForm } from "./formData";
import { getClientIp } from "./rateLimit";
import { destroySession, endSession, type SessionGrant } from "./session";
import { AUTH_FIELDS, type AuthFormState } from "./types";

// Un fichier "use server" n'exporte que des fonctions asynchrones : les types et les noms
// de champs vivent dans ./types, les aides ci-dessous ne sont pas exportées.

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Langue de retour : `fr` ou `en`, sinon le français. */
const localeField = z.enum(locales).catch(defaultLocale);
const text = z.string().optional();
/** Case à cocher : `"on"` quand cochée, absente sinon. */
const checkbox = z.string().optional().transform((value) => value === "on");

const localeFormSchema = z.strictObject({ [AUTH_FIELDS.locale]: localeField });
const registerFormSchema = z.strictObject({
  [AUTH_FIELDS.locale]: localeField,
  [AUTH_FIELDS.username]: text,
  [AUTH_FIELDS.password]: text,
  [AUTH_FIELDS.passwordConfirm]: text,
  [AUTH_FIELDS.terms]: checkbox,
  [AUTH_FIELDS.remember]: checkbox,
});
const loginFormSchema = z.strictObject({
  [AUTH_FIELDS.locale]: localeField,
  [AUTH_FIELDS.username]: text,
  [AUTH_FIELDS.password]: text,
  [AUTH_FIELDS.remember]: checkbox,
});
const guestFormSchema = z.strictObject({ [AUTH_FIELDS.locale]: localeField, [AUTH_FIELDS.pseudo]: text });

/**
 * Remplace la session du navigateur : l'ancienne session (si le cookie en porte une) est
 * supprimée en base avant de poser la nouvelle, pour qu'elle ne reste pas valable
 * (fixation de session, ou changement de compte sur un poste partagé).
 */
async function replaceSessionCookie(
  deps: AuthDeps,
  cookieStore: CookieStore,
  grant: SessionGrant,
): Promise<void> {
  const name = getSessionCookieName();
  await destroySession(deps.sessions, cookieStore.get(name)?.value);
  cookieStore.set(name, grant.token, sessionCookieOptions(grant.maxAgeSeconds));
}

/**
 * Enchaînement commun : exécute le parcours, pose le cookie, puis redirige vers l'accueil
 * de la langue. `redirect` lève une exception de contrôle : il reste donc hors du `try`.
 */
async function runAuthAction(
  actionName: string,
  locale: Locale,
  flow: (deps: AuthDeps, ip: string, locale: Locale) => Promise<AuthFlowResult>,
): Promise<AuthFormState> {
  let result: AuthFlowResult;
  try {
    const deps = getAuthDeps();
    const ip = getClientIp(await headers());
    result = await flow(deps, ip, locale);
    if (result.ok) await replaceSessionCookie(deps, await cookies(), result.grant);
  } catch (error) {
    // Ni jeton, ni mot de passe, ni message d'erreur Drizzle (il contient les paramètres).
    console.error(`[auth] ${actionName} failed`, describeError(error));
    return { status: "error", code: "UNKNOWN" };
  }

  if (!result.ok) {
    return { status: "error", ...result.error };
  }
  redirect(`/${locale}`);
}

export async function register(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const form = readForm(formData, registerFormSchema);
  return runAuthAction("register", form.locale, (deps, ip, locale) =>
    registerMember(deps, {
      ip,
      username: form.username,
      password: form.password,
      passwordConfirm: form.passwordConfirm,
      termsAccepted: form.terms,
      remember: form.remember,
      locale,
    }),
  );
}

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const form = readForm(formData, loginFormSchema);
  return runAuthAction("login", form.locale, (deps, ip, locale) =>
    loginMember(deps, {
      ip,
      username: form.username,
      password: form.password,
      remember: form.remember,
      locale,
    }),
  );
}

export async function continueAsGuest(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const form = readForm(formData, guestFormSchema);
  return runAuthAction("continueAsGuest", form.locale, (deps, ip, locale) =>
    createGuest(deps, { ip, pseudo: form.pseudo, locale }),
  );
}

/** Supprime la session en base et le cookie, puis retourne à l'accueil de la langue. */
export async function logout(formData: FormData): Promise<void> {
  const { locale } = readForm(formData, localeFormSchema);

  try {
    const cookieStore = await cookies();
    const name = getSessionCookieName();
    const token = cookieStore.get(name)?.value;
    cookieStore.delete(name);
    const deps = getAuthDeps();
    // Un invité est supprimé avec sa session (H-2) ; un membre garde son compte.
    await endSession(deps.sessions, deps.users, token);
  } catch (error) {
    console.error("[auth] logout failed", describeError(error));
  }

  redirect(`/${locale}`);
}
