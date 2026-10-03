"use client";

import { usePathname } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { getOtherLocale, type Locale } from "@/i18n/config";
import { getPathInLocale } from "@/i18n/paths";

type LanguageSwitcherProps = {
  locale: Locale;
  labels: Dictionary["language"];
};

/**
 * Lien vers la même page dans l'autre langue.
 *
 * Le choix est mémorisé par le proxy (cookie NEXT_LOCALE) dès qu'une page
 * `/<locale>/...` est servie, y compris sur un clic du milieu ou un nouvel
 * onglet : aucun `onClick` n'est nécessaire.
 *
 * C'est volontairement un `<a>` et non un `<Link>` : changer de langue change
 * `lang` sur `<html>`, donc le layout racine, ce qui provoque de toute façon un
 * rechargement complet. Une navigation côté client le re-rendrait dans le
 * navigateur, et React 19 avertit alors qu'il re-rend le `<script>` du thème.
 *
 * Le nom accessible est le texte visible (WCAG 2.5.3) ; `lang` indique la langue
 * de ce texte et `hrefLang` celle de la cible.
 */
export function LanguageSwitcher({ locale, labels }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const target = getOtherLocale(locale);

  return (
    <a
      href={getPathInLocale(pathname, target)}
      hrefLang={target}
      lang={target}
      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
    >
      {labels.names[target]}
    </a>
  );
}
