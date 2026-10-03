export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Cookie qui mémorise le choix explicite de langue de l'utilisateur. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Attributs du cookie de langue : tout le site, un an, jamais envoyé en cross-site sauf navigation. */
export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
} as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Pour deux langues, « l'autre » langue est déterminée sans ambiguïté. */
export function getOtherLocale(locale: Locale): Locale {
  return locale === "fr" ? "en" : "fr";
}
