import { generateCodeVerifier, generateState } from "arctic";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import type { AuthLimiters } from "../rateLimit";
import { ipRateLimitKey } from "../rateLimit";
import { oauthCookieNames, oauthCookieOptions, type OAuthCookie, type OAuthRedirect } from "./cookies";
import type { OAuthNotice, OAuthProviderClient, OAuthProviderName } from "./providers";

export interface OAuthStartDeps {
  limiters: Pick<AuthLimiters, "oauthStarts">;
  getProvider: (name: OAuthProviderName) => OAuthProviderClient | null;
}

export interface OAuthStartInput {
  provider: OAuthProviderName;
  /** Valeur brute du paramètre `locale` : seule `fr` ou `en` est retenue. */
  rawLocale: string | null;
  ip: string;
}

/** Langue de retour : `fr` ou `en`, sinon le français. */
export function parseOAuthLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Retour vers la page de connexion avec un message. */
export function loginNoticeLocation(locale: Locale, notice: OAuthNotice): string {
  return `/${locale}/login?oauth=${notice}`;
}

/**
 * AUTH-2, AUTH-3 : départ du flux. Génère `state` (et `codeVerifier` pour Discord, PKCE), les
 * place dans des cookies temporaires, et renvoie l'URL d'autorisation du fournisseur.
 * Un fournisseur non configuré, ou une IP au-delà de 60 départs par 15 minutes, renvoie à la
 * page de connexion avec un message.
 */
export function startOAuth(deps: OAuthStartDeps, input: OAuthStartInput): OAuthRedirect {
  const locale = parseOAuthLocale(input.rawLocale);

  if (!deps.limiters.oauthStarts.consume(ipRateLimitKey(input.ip))) {
    return { location: loginNoticeLocation(locale, "failed"), cookies: [] };
  }
  const client = deps.getProvider(input.provider);
  if (!client) return { location: loginNoticeLocation(locale, "unavailable"), cookies: [] };

  const state = generateState();
  const codeVerifier = client.usesPkce ? generateCodeVerifier() : null;
  const names = oauthCookieNames(input.provider);
  const options = oauthCookieOptions();

  const cookies: OAuthCookie[] = [
    { name: names.state, value: state, options },
    { name: names.locale, value: locale, options },
  ];
  if (codeVerifier !== null) cookies.push({ name: names.verifier, value: codeVerifier, options });

  return { location: client.createAuthorizationURL(state, codeVerifier).toString(), cookies };
}
