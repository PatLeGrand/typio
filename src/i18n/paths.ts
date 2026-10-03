import { isLocale, type Locale } from "./config";

// Préfixes que le proxy ne doit jamais réécrire, même si le matcher les laisse passer.
const UNPREFIXED_SEGMENTS = ["api", "_next"];

function firstSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/** Locale portée par le chemin (`/en/room` donne `en`), ou `null` s'il n'en porte pas. */
export function getPathLocale(pathname: string): Locale | null {
  const segment = firstSegment(pathname);
  return isLocale(segment) ? segment : null;
}

/** Vrai si le chemin commence déjà par une locale supportée (`/fr`, `/en/...`). */
export function hasLocalePrefix(pathname: string): boolean {
  return getPathLocale(pathname) !== null;
}

/** Vrai si le proxy doit rediriger ce chemin vers `/<locale>/...`. */
export function needsLocaleRedirect(pathname: string): boolean {
  if (hasLocalePrefix(pathname)) return false;
  return !UNPREFIXED_SEGMENTS.includes(firstSegment(pathname));
}

/** Préfixe le chemin par la locale (`/` devient `/fr`, `/a` devient `/fr/a`). */
export function prefixWithLocale(pathname: string, locale: Locale): string {
  return pathname === "/" || pathname === "" ? `/${locale}` : `/${locale}${pathname}`;
}

/**
 * Le même chemin dans une autre langue : remplace le segment de locale, ou
 * préfixe le chemin s'il n'en porte pas.
 */
export function getPathInLocale(pathname: string, target: Locale): string {
  if (!hasLocalePrefix(pathname)) return prefixWithLocale(pathname, target);
  const rest = pathname.slice(firstSegment(pathname).length + 1);
  return `/${target}${rest}`;
}
