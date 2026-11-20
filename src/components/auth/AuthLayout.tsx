import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { displayFont } from "../home/homeFonts";
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
 * (formulaire aéré à gauche, panneau « stade de nuit » à droite), une seule colonne en dessous.
 * La colonne du formulaire a son propre en-tête (logo) et son pied de page (confidentialité,
 * langue, thème) : ces pages n'utilisent donc pas `SiteHeader`.
 */
export function AuthLayout({ locale, dictionary, panel, children }: AuthLayoutProps) {
  return (
    <div
      className={`${displayFont.variable} relative mx-auto grid min-h-dvh w-full max-w-[1440px] overflow-x-clip px-4 pb-4 pt-6 sm:px-6 sm:pb-6 sm:pt-7 lg:grid-cols-2 lg:gap-6 lg:p-6`}
    >
      <div
        aria-hidden="true"
        className="track-surface pointer-events-none absolute inset-x-0 top-0 h-3 border-b border-track-accent lg:hidden"
      >
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_12px,transparent_12px_24px)] opacity-85" />
      </div>
      <div className="mx-auto flex w-full min-w-0 max-w-[660px] flex-col">
        <header className="py-2 lg:px-8 lg:pt-6">
          <nav aria-label={dictionary.navigation.main}>
            <Link href={`/${locale}`} className="inline-block rounded-field">
              <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 items-center justify-center py-8 sm:py-12 lg:px-8">
          <div className="w-full min-w-0 max-w-[440px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border/70 pb-1 pt-4 text-xs text-muted lg:mx-8">
          <p>{dictionary.footer.copyright}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href={`/${locale}/privacy`} className="road-link inline-flex min-h-11 items-center rounded-field hover:text-foreground">
              {dictionary.footer.privacy}
            </Link>
            <LanguageSwitcher locale={locale} labels={dictionary.language} />
            <ThemeToggle labels={dictionary.theme} />
          </div>
        </footer>
      </div>
      {/* Panneau « stade de nuit » épinglé à la hauteur de la fenêtre, prolongement sobre de l'accueil. */}
      <aside className="relative hidden overflow-hidden rounded-panel bg-screen text-screen-text ring-1 ring-inset ring-screen-border lg:sticky lg:top-6 lg:flex lg:min-h-[calc(100dvh-3rem)] lg:self-start">
        <svg
          aria-hidden="true"
          viewBox="0 0 640 820"
          fill="none"
          preserveAspectRatio="xMaxYMin slice"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <path d="M470 -40C470 150 560 250 690 250" stroke="var(--screen-border)" strokeWidth="1.5" opacity="0.85" />
          <path d="M412 -40C412 184 522 308 690 308" stroke="var(--screen-border)" strokeWidth="1.5" opacity="0.55" />
        </svg>
        <div className="relative z-10 flex w-full px-10 pb-12 pt-10 xl:px-12 xl:pb-14 xl:pt-12">{panel}</div>
        <div
          aria-hidden="true"
          className="track-surface pointer-events-none absolute inset-x-0 bottom-0 h-3 border-t border-track-line/35"
        >
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_12px,transparent_12px_24px)] opacity-75" />
        </div>
      </aside>
    </div>
  );
}
