import type { AuthDeps } from "../authFlows";
import { getSessionCookieName, sessionCookieOptions } from "../cookie";
import { describeError } from "../errors";
import { ipRateLimitKey } from "../rateLimit";
import type { Semaphore } from "../semaphore";
import { destroySession } from "../session";
import { expiredOAuthCookie, oauthCookieNames, type OAuthCookie, type OAuthRedirect } from "./cookies";
import { loginNoticeLocation, parseOAuthLocale } from "./locale";
import type { OAuthNotice, OAuthProfile, OAuthProviderClient, OAuthProviderName } from "./providers";
import { completeOAuthSignIn } from "./signIn";
import { statesMatch } from "./state";

export interface OAuthCallbackDeps {
  auth: AuthDeps;
  getProvider: (name: OAuthProviderName) => OAuthProviderClient | null;
  fetchProfile: (provider: OAuthProviderName, accessToken: string) => Promise<OAuthProfile>;
  /** Plafond d'échanges simultanés (jeton + profil) : chacun est une requête sortante. */
  exchanges: Semaphore;
}

export interface OAuthCallbackInput {
  provider: OAuthProviderName;
  ip: string;
  /** Paramètres de la requête de retour (`null` s'ils sont absents). */
  query: { code: string | null; state: string | null; error: string | null };
  /** Cookies de la requête : ceux du flux, et le cookie de session du navigateur. */
  cookies: { state?: string; verifier?: string; locale?: string; session?: string };
}

/**
 * AUTH-2, AUTH-3 : retour du fournisseur. Ordre : limiteur par IP (avant tout travail), puis le
 * `state` (un lien forgé ne doit rien pouvoir faire, pas même afficher « annulé »), puis le
 * refus de l'utilisateur, puis l'échange du code, borné par un sémaphore. Toute erreur renvoie à
 * la page de connexion avec un message, jamais de détail. Les cookies temporaires sont TOUJOURS
 * effacés.
 *
 * Le compte fournisseur déjà relié ouvre une session sur CE membre ; sinon un nouveau membre est
 * créé. Quel que soit l'état du navigateur, son ancienne session est révoquée.
 */
export async function handleOAuthCallback(
  deps: OAuthCallbackDeps,
  input: OAuthCallbackInput,
): Promise<OAuthRedirect> {
  const locale = parseOAuthLocale(input.cookies.locale);
  const names = oauthCookieNames(input.provider);
  const cookies: OAuthCookie[] = [
    expiredOAuthCookie(names.state),
    expiredOAuthCookie(names.verifier),
    expiredOAuthCookie(names.locale),
  ];
  const back = (notice: OAuthNotice): OAuthRedirect => ({
    location: loginNoticeLocation(locale, notice),
    cookies,
  });

  if (!deps.auth.limiters.oauthCallbacks.consume(ipRateLimitKey(input.ip))) return back("failed");
  if (!statesMatch(input.cookies.state, input.query.state)) return back("failed");
  if (input.query.error !== null) return back(input.query.error === "access_denied" ? "cancelled" : "failed");
  if (input.query.code === null || input.query.code === "") return back("failed");

  const client = deps.getProvider(input.provider);
  if (!client) return back("unavailable");
  // Sans le code de vérification posé au départ, un échange PKCE ne peut pas aboutir.
  if (client.usesPkce && !input.cookies.verifier) return back("failed");

  const code = input.query.code;
  const codeVerifier = client.usesPkce ? (input.cookies.verifier ?? null) : null;
  try {
    const profile = await deps.exchanges.run(async () =>
      deps.fetchProfile(input.provider, await client.exchangeCode(code, codeVerifier)),
    );

    const grant = await completeOAuthSignIn(deps.auth, { provider: input.provider, profile, locale });
    // Comme une connexion par mot de passe : l'ancienne session du navigateur (membre ou
    // invité) est révoquée avant de poser la nouvelle.
    await destroySession(deps.auth.sessions, input.cookies.session);
    cookies.push({
      name: getSessionCookieName(),
      value: grant.token,
      options: sessionCookieOptions(grant.maxAgeSeconds),
    });
    return { location: `/${locale}`, cookies };
  } catch (error) {
    // Ni jeton, ni code, ni corps de réponse : le nom et le code de l'erreur seulement.
    console.error("[auth] oauth callback failed", { provider: input.provider, ...describeError(error) });
    return back("failed");
  }
}
