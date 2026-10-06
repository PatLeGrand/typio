import { generateCodeVerifier, generateState } from "arctic";
import { ipRateLimitKey, type AuthLimiters } from "../rateLimit";
import { validateSession, type SessionRepository } from "../session";
import { oauthCookieNames, oauthCookieOptions, type OAuthCookie, type OAuthRedirect } from "./cookies";
import { loginNoticeLocation, parseOAuthLocale } from "./locale";
import type { OAuthProviderClient, OAuthProviderName } from "./providers";

export interface OAuthStartDeps {
  limiters: Pick<AuthLimiters, "oauthStarts">;
  sessions: SessionRepository;
  now: () => Date;
  getProvider: (name: OAuthProviderName) => OAuthProviderClient | null;
}

export interface OAuthStartInput {
  provider: OAuthProviderName;
  /** Valeur brute du paramètre `locale` : seule `fr` ou `en` est retenue. */
  rawLocale: string | null;
  ip: string;
  /** Jeton du cookie de session du navigateur, s'il y en a un. */
  sessionToken?: string;
  /**
   * Vrai quand le navigateur annonce une navigation lancée depuis un autre site
   * (`Sec-Fetch-Site: cross-site`). Les liens de Typio donnent `same-origin`, une URL tapée
   * à la main `none`.
   */
  crossSite?: boolean;
}

/**
 * AUTH-2, AUTH-3 : départ du flux. Génère `state` (et `codeVerifier` pour Discord, PKCE), les
 * place dans des cookies temporaires, et renvoie l'URL d'autorisation du fournisseur.
 *
 * Un MEMBRE déjà connecté n'a rien à faire ici (le flux ne sait ni lier ni changer de compte) :
 * il retourne à l'accueil sans cookie. Un invité ou un visiteur peut s'y connecter.
 * Un fournisseur non configuré, ou une IP au-delà de 300 départs par 15 minutes, renvoie à la
 * page de connexion avec un message.
 *
 * Un départ lancé depuis un autre site est refusé : sinon une page tierce pourrait faire
 * naviguer un invité vers ce flux, et, s'il a déjà autorisé Typio chez le fournisseur,
 * remplacer sa partie d'invité par un compte membre sans geste de sa part.
 */
export async function startOAuth(deps: OAuthStartDeps, input: OAuthStartInput): Promise<OAuthRedirect> {
  const locale = parseOAuthLocale(input.rawLocale);
  if (input.crossSite) return { location: `/${locale}/login`, cookies: [] };

  if (!deps.limiters.oauthStarts.consume(ipRateLimitKey(input.ip))) {
    return { location: loginNoticeLocation(locale, "failed"), cookies: [] };
  }
  const user = await validateSession(deps.sessions, input.sessionToken, deps.now());
  if (user?.kind === "member") return { location: `/${locale}`, cookies: [] };

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
