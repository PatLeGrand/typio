import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

type SiteHeaderProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function SiteHeader({ locale, dictionary }: SiteHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="text-xl font-semibold tracking-tight">{dictionary.site.name}</span>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </div>
    </header>
  );
}
