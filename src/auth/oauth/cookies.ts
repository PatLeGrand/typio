import type { OAuthProviderName } from "./providers";

/** Les cookies temporaires du flux vivent 10 minutes : le temps d'aller chez le fournisseur et de revenir. */
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

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
 *
 * En production, le préfixe `__Host-` oblige le navigateur à n'accepter le cookie que s'il est
 * `Secure`, `Path=/` et sans `Domain` : un sous-domaine voisin ne peut ni le poser ni l'écraser
 * (injection d'un `state` ou d'un `code_verifier` choisis par un attaquant). Comme pour le cookie
 * de session, le préfixe est refusé en http : en développement, noms simples.
 */
export function oauthCookieNames(
  provider: OAuthProviderName,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): OAuthCookieNames {
  const prefix = nodeEnv === "production" ? "__Host-" : "";
  return {
    state: `${prefix}typio_oauth_state_${provider}`,
    verifier: `${prefix}typio_oauth_verifier_${provider}`,
    locale: `${prefix}typio_oauth_locale_${provider}`,
  };
}

/**
 * `HttpOnly`, `SameSite=Lax` (le retour du fournisseur est une navigation GET de haut niveau),
 * `Path=/` et jamais de `Domain` (exigés par `__Host-`), `Secure` en production.
 */
export function oauthCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Required<OAuthCookieOptions> {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: nodeEnv === "production",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

/** Efface un cookie temporaire : mêmes attributs de portée, échéance immédiate. */
export function expiredOAuthCookie(name: string, nodeEnv: string | undefined = process.env.NODE_ENV): OAuthCookie {
  return { name, value: "", options: { ...oauthCookieOptions(nodeEnv), maxAge: 0 } };
}

/** Redirection à renvoyer au navigateur, avec les cookies à poser ou effacer. */
export interface OAuthRedirect {
  /** Chemin relatif (retour vers le site) ou URL d'autorisation absolue du fournisseur. */
  location: string;
  cookies: OAuthCookie[];
}
