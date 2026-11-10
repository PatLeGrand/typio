import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { getPathLocale, needsLocaleRedirect, prefixWithLocale } from "@/i18n/paths";
import { resolveLocale } from "@/i18n/negotiate";

/** Pages existantes sous `/<locale>`, une entrée par forme ; `[x]` est un segment dynamique. */
export const KNOWN_ROUTES = [
  "",
  "login",
  "register",
  "guest",
  "play",
  "privacy",
  "profile",
  "history",
  "history/[raceId]",
  "race",
  "race/settings",
  "room/[code]",
  "invite/[token]",
];

function isKnownRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  return KNOWN_ROUTES.some((route) => {
    const pattern = route === "" ? [] : route.split("/");
    return pattern.length === segments.length && pattern.every((part, i) => part.startsWith("[") || part === segments[i]);
  });
}

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

  const pathLocale = getPathLocale(pathname);
  // Adresse inconnue : page 404 rendue en HTML (un `notFound()` ne sert qu'un document vide, sans thème).
  // `/<locale>/missing` est absente de la liste : son accès direct donne aussi 404.
  const response =
    pathLocale !== null && !isKnownRoute(pathname)
      ? // Next compare l'hôte de la destination à celui d'écoute (`localhost` pour 0.0.0.0 ou sans
        // `--hostname`, comme en production) : une destination clonée de `request.nextUrl` est interne.
        // Avec `--hostname 127.0.0.1`, Next la juge externe et la proxifie (ECONNRESET) : ne pas l'utiliser.
        NextResponse.rewrite(Object.assign(request.nextUrl.clone(), { pathname: `/${pathLocale}/missing` }), { status: 404 })
      : NextResponse.next();
  if (pathLocale && request.cookies.get(LOCALE_COOKIE)?.value !== pathLocale) {
    response.cookies.set(LOCALE_COOKIE, pathLocale, LOCALE_COOKIE_OPTIONS);
  }
  return response;
}

export const config = {
  // Exclut /api, /_next et tout chemin contenant un point (favicon.ico, fichiers statiques).
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)"],
};
