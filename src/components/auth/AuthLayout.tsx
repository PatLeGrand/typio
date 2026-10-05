import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";

type AuthLayoutProps = {
  locale: Locale;
  dictionary: Dictionary;
  /** Panneau de droite (promesse + illustration). Masqué sous le breakpoint `lg`. */
  panel: ReactNode;
  children: ReactNode;
};

/**
 * Cadre des pages de connexion, d'inscription et d'invité : deux colonnes à partir de `lg`
 * (formulaire à gauche, panneau violet à droite), une seule colonne en dessous. La colonne du
 * formulaire a son propre en-tête (logo) et son pied de page (confidentialité, langue, thème) :
 * ces pages n'utilisent donc pas `SiteHeader`.
 */
export function AuthLayout({ locale, dictionary, panel, children }: AuthLayoutProps) {
  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-[1440px] gap-6 p-4 sm:p-6 lg:grid-cols-2">
      <div className="mx-auto flex w-full min-w-0 max-w-[660px] flex-col">
        <header className="py-2 lg:px-8 lg:pt-6">
          <Link href={`/${locale}`} className="inline-block rounded-field">
            <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[448px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-2 text-[11px] text-muted lg:px-8">
          <p>{dictionary.footer.copyright}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href={`/${locale}/privacy`} className="inline-flex min-h-11 items-center rounded-field hover:text-foreground">
              {dictionary.footer.privacy}
            </Link>
            <LanguageSwitcher locale={locale} labels={dictionary.language} />
            <ThemeToggle labels={dictionary.theme} />
          </div>
        </footer>
      </div>
      {/* Épinglé et de la hauteur de la fenêtre (comme la maquette) même si le formulaire est plus long. */}
      <aside className="hidden overflow-hidden rounded-panel bg-accent-panel px-8 py-10 lg:sticky lg:top-6 lg:flex lg:min-h-[calc(100dvh-3rem)] lg:self-start">
        {panel}
      </aside>
    </div>
  );
}
