import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import type { OAuthNotice } from "./providers";

/** Langue de retour : `fr` ou `en`, sinon le français. */
export function parseOAuthLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Retour vers la page de connexion avec un message. */
export function loginNoticeLocation(locale: Locale, notice: OAuthNotice): string {
  return `/${locale}/login?oauth=${notice}`;
}
