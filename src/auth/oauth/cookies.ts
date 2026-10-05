import type { OAuthProviderName } from "./providers";

/** Les cookies temporaires du flux vivent 10 minutes : le temps d'aller chez le fournisseur et de revenir. */
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;
/** Limité aux routes `/api/auth` : ni les pages ni le reste de l'API ne reçoivent ces cookies. */
export const OAUTH_COOKIE_PATH = "/api/auth";

export interface OAuthCookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax";
  path?: string;
  secure?: boolean;
  maxAge?: number;
}

/** Cookie à poser (ou à effacer, `maxAge: 0`) sur la réponse. */
export interface OAuthCookie {
  name: string;
  value: string;
  options: OAuthCookieOptions;
}

export interface OAuthCookieNames {
  state: string;
  verifier: string;
  locale: string;
}

/**
 * Noms des cookies temporaires, propres à chaque fournisseur : deux connexions lancées dans
 * deux onglets ne s'écrasent pas, et un état posé pour GitHub ne vaut jamais pour Discord.
 * En production, le préfixe `__Secure-` oblige le navigateur à refuser le cookie hors https.
 */
export function oauthCookieNames(
  provider: OAuthProviderName,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): OAuthCookieNames {
  const prefix = nodeEnv === "production" ? "__Secure-" : "";
  return {
    state: `${prefix}typio_oauth_state_${provider}`,
    verifier: `${prefix}typio_oauth_verifier_${provider}`,
    locale: `${prefix}typio_oauth_locale_${provider}`,
  };
}

/** `HttpOnly`, `SameSite=Lax` (le retour du fournisseur est une navigation GET de haut niveau), `Secure` en production. */
export function oauthCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Required<OAuthCookieOptions> {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    secure: nodeEnv === "production",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

/** Efface un cookie temporaire : mêmes attributs de portée (`Path`), échéance immédiate. */
export function expiredOAuthCookie(name: string, nodeEnv: string | undefined = process.env.NODE_ENV): OAuthCookie {
  return { name, value: "", options: { ...oauthCookieOptions(nodeEnv), maxAge: 0 } };
}

/** Redirection à renvoyer au navigateur, avec les cookies à poser ou effacer. */
export interface OAuthRedirect {
  /** Chemin relatif (retour vers le site) ou URL d'autorisation absolue du fournisseur. */
  location: string;
  cookies: OAuthCookie[];
}
