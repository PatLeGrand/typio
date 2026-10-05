import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type SiteHeaderProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function SiteHeader({ locale, dictionary }: SiteHeaderProps) {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-5 sm:px-8">
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </div>
    </header>
  );
}
