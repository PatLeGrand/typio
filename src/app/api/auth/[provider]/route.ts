import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionCookieName } from "@/auth/cookie";
import { getAuthDeps } from "@/auth/deps";
import { describeError } from "@/auth/errors";
import { getOAuthProvider } from "@/auth/oauth/config";
import { loginNoticeLocation, parseOAuthLocale } from "@/auth/oauth/locale";
import { providerNotFound, toRedirectResponse } from "@/auth/oauth/oauthResponse";
import { oauthProviderSchema } from "@/auth/oauth/providers";
import { startOAuth } from "@/auth/oauth/start";
import { getClientIp } from "@/auth/rateLimit";

const routeParamsSchema = z.strictObject({ provider: oauthProviderSchema });

/**
 * AUTH-01 : départ de la connexion GitHub ou Discord, `GET /api/auth/{provider}?locale=fr|en`.
 * Pose le `state` (et le code PKCE de Discord) en cookies temporaires, puis redirige vers le
 * fournisseur. Une route et non une Server Action : c'est une simple navigation (lien).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const route = routeParamsSchema.safeParse(await params);
  if (!route.success) return providerNotFound();
  const { provider } = route.data;

  const rawLocale = request.nextUrl.searchParams.get("locale");
  try {
    const { limiters, sessions, now } = getAuthDeps();
    return toRedirectResponse(
      await startOAuth(
        { limiters, sessions, now, getProvider: getOAuthProvider },
        {
          provider,
          rawLocale,
          ip: getClientIp(request.headers),
          sessionToken: request.cookies.get(getSessionCookieName())?.value,
          crossSite: request.headers.get("sec-fetch-site") === "cross-site",
        },
      ),
    );
  } catch (error) {
    console.error("[auth] oauth start failed", { provider, ...describeError(error) });
    return toRedirectResponse({
      location: loginNoticeLocation(parseOAuthLocale(rawLocale), "failed"),
      cookies: [],
    });
  }
}
