import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { SiteFooter } from "./SiteFooter";
import { ThemeToggle } from "./ThemeToggle";

export function StatusPageFrame({ locale, dictionary, children }: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
        </Link>
        <nav aria-label={dictionary.navigation.preferences} className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </nav>
      </header>
      {children}
      <SiteFooter locale={locale} labels={dictionary.footer} />
    </div>
  );
}
