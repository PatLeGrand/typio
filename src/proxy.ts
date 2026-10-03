import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { getPathLocale, needsLocaleRedirect, prefixWithLocale } from "@/i18n/paths";
import { resolveLocale } from "@/i18n/negotiate";

/**
 * Chemin sans locale : redirige vers `/<locale>/...` (cookie, puis Accept-Language, puis français).
 * Chemin avec locale : mémorise cette langue dans le cookie NEXT_LOCALE si besoin, pour que
 * le choix survive même quand le lien du sélecteur est ouvert dans un nouvel onglet.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (needsLocaleRedirect(pathname)) {
    const locale = resolveLocale({
      cookie: request.cookies.get(LOCALE_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    });

    const url = request.nextUrl.clone();
    url.pathname = prefixWithLocale(pathname, locale);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  const pathLocale = getPathLocale(pathname);
  if (pathLocale && request.cookies.get(LOCALE_COOKIE)?.value !== pathLocale) {
    response.cookies.set(LOCALE_COOKIE, pathLocale, LOCALE_COOKIE_OPTIONS);
  }
  return response;
}

export const config = {
  // Exclut /api, /_next et tout chemin contenant un point (favicon.ico, fichiers statiques).
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)"],
};
