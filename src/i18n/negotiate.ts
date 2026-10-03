import { defaultLocale, isLocale, type Locale } from "./config";

// Un en-tête Accept-Language légitime tient largement là-dedans ; on borne
// l'entrée pour ne pas analyser une valeur arbitrairement longue.
const MAX_HEADER_LENGTH = 1024;

const LANGUAGE_TAG = /^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/i;
const QUALITY = /^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;

type Candidate = { locale: Locale; quality: number; position: number };

/**
 * Choisit la première langue supportée de l'en-tête Accept-Language, en
 * respectant les q-values (« fr-CA » et « en-US » comptent comme « fr » et
 * « en »). Renvoie `null` si l'en-tête est absent, invalide ou n'offre aucune
 * langue supportée.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;

  const candidates: Candidate[] = [];
  const entries = acceptLanguage.slice(0, MAX_HEADER_LENGTH).split(",");

  entries.forEach((entry, position) => {
    const [rawTag, ...params] = entry.split(";").map((part) => part.trim());
    if (!rawTag || !LANGUAGE_TAG.test(rawTag)) return;

    let quality = 1;
    for (const param of params) {
      const match = QUALITY.exec(param);
      if (match) quality = Number(match[1]);
    }
    // q=0 signifie « non acceptable ».
    if (quality === 0) return;

    const language = rawTag.split("-")[0].toLowerCase();
    if (isLocale(language)) candidates.push({ locale: language, quality, position });
  });

  candidates.sort((a, b) => b.quality - a.quality || a.position - b.position);
  return candidates[0]?.locale ?? null;
}

type ResolveLocaleInput = {
  /** Valeur du cookie NEXT_LOCALE, si présent. */
  cookie?: string | null;
  acceptLanguage?: string | null;
};

/** Cookie (choix explicite) > Accept-Language > langue par défaut. */
export function resolveLocale({ cookie, acceptLanguage }: ResolveLocaleInput): Locale {
  if (isLocale(cookie)) return cookie;
  return negotiateLocale(acceptLanguage) ?? defaultLocale;
}
