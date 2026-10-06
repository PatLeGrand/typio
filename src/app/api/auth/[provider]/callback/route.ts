import type { NextRequest } from "next/server";
import { getSessionCookieName } from "@/auth/cookie";
import { getAuthDeps } from "@/auth/deps";
import { describeError } from "@/auth/errors";
import { handleOAuthCallback } from "@/auth/oauth/callback";
import { getOAuthProvider } from "@/auth/oauth/config";
import { expiredOAuthCookie, oauthCookieNames } from "@/auth/oauth/cookies";
import { getOAuthExchangeSemaphore } from "@/auth/oauth/exchangeSemaphore";
import { loginNoticeLocation, parseOAuthLocale } from "@/auth/oauth/locale";
import { providerNotFound, toRedirectResponse } from "@/auth/oauth/oauthResponse";
import { fetchOAuthProfile } from "@/auth/oauth/profile";
import { isOAuthProviderName } from "@/auth/oauth/providers";
import { getClientIp } from "@/auth/rateLimit";

/**
 * AUTH-2, AUTH-3 : retour du fournisseur, `GET /api/auth/{provider}/callback`. Vérifie le
 * `state`, échange le code, lit l'identifiant du compte, puis ouvre la session et redirige vers
 * le site.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProviderName(provider)) return providerNotFound();

  const names = oauthCookieNames(provider);
  const cookies = request.cookies;
  const locale = cookies.get(names.locale)?.value;
  const query = request.nextUrl.searchParams;

  try {
    return toRedirectResponse(
      await handleOAuthCallback(
        {
          auth: getAuthDeps(),
          getProvider: getOAuthProvider,
          fetchProfile: fetchOAuthProfile,
          exchanges: getOAuthExchangeSemaphore(),
        },
        {
          provider,
          ip: getClientIp(request.headers),
          query: { code: query.get("code"), state: query.get("state"), error: query.get("error") },
          cookies: {
            state: cookies.get(names.state)?.value,
            verifier: cookies.get(names.verifier)?.value,
            locale,
            session: cookies.get(getSessionCookieName())?.value,
          },
        },
      ),
    );
  } catch (error) {
    // `handleOAuthCallback` rattrape ses propres erreurs : on n'arrive ici que si la
    // configuration de base manque (`DATABASE_URL`). Les cookies temporaires partent quand même.
    console.error("[auth] oauth callback setup failed", { provider, ...describeError(error) });
    return toRedirectResponse({
      location: loginNoticeLocation(parseOAuthLocale(locale), "failed"),
      cookies: [
        expiredOAuthCookie(names.state),
        expiredOAuthCookie(names.verifier),
        expiredOAuthCookie(names.locale),
      ],
    });
  }
}
