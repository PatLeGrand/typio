"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
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
import { getClientIp } from "./rateLimit";
import { destroySession, type SessionGrant } from "./session";
import { AUTH_FIELDS, type AuthFormState } from "./types";

// Un fichier "use server" n'exporte que des fonctions asynchrones : les types et les noms
// de champs vivent dans ./types, les aides ci-dessous ne sont pas exportées.

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function parseLocale(value: FormDataEntryValue | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Les valeurs de formulaire peuvent être des fichiers : seul le texte est utilisable. */
function readText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

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
  formData: FormData,
  flow: (deps: AuthDeps, ip: string, locale: Locale) => Promise<AuthFlowResult>,
): Promise<AuthFormState> {
  const locale = parseLocale(formData.get(AUTH_FIELDS.locale));

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
  return runAuthAction("register", formData, (deps, ip, locale) =>
    registerMember(deps, {
      ip,
      username: readText(formData, AUTH_FIELDS.username),
      password: readText(formData, AUTH_FIELDS.password),
      remember: formData.get(AUTH_FIELDS.remember) === "on",
      locale,
    }),
  );
}

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return runAuthAction("login", formData, (deps, ip, locale) =>
    loginMember(deps, {
      ip,
      username: readText(formData, AUTH_FIELDS.username),
      password: readText(formData, AUTH_FIELDS.password),
      remember: formData.get(AUTH_FIELDS.remember) === "on",
      locale,
    }),
  );
}

export async function continueAsGuest(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  return runAuthAction("continueAsGuest", formData, (deps, ip, locale) =>
    createGuest(deps, { ip, pseudo: readText(formData, AUTH_FIELDS.pseudo), locale }),
  );
}

/** Supprime la session en base et le cookie, puis retourne à l'accueil de la langue. */
export async function logout(formData: FormData): Promise<void> {
  const locale = parseLocale(formData.get(AUTH_FIELDS.locale));

  try {
    const cookieStore = await cookies();
    const name = getSessionCookieName();
    const token = cookieStore.get(name)?.value;
    cookieStore.delete(name);
    await destroySession(getAuthDeps().sessions, token);
  } catch (error) {
    console.error("[auth] logout failed", describeError(error));
  }

  redirect(`/${locale}`);
}
