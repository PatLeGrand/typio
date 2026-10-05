import Link from "next/link";
import { logout } from "@/auth/actions";
import { AUTH_FIELDS, type CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type SiteHeaderProps = {
  locale: Locale;
  dictionary: Dictionary;
  /** Utilisateur connecté (membre ou invité), ou `null` pour un visiteur. */
  user: CurrentUser | null;
};

export function SiteHeader({ locale, dictionary, user }: SiteHeaderProps) {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-5 sm:px-8">
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} tagline={dictionary.brand.tagline} />
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {user ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {user.displayName}
                {user.kind === "guest" ? (
                  <span className="ml-1.5 text-xs font-normal text-muted">({dictionary.header.guest})</span>
                ) : null}
              </p>
              {user.kind === "guest" ? (
                <ButtonLink href={`/${locale}/register`} variant="ghost">
                  {dictionary.header.signUp}
                </ButtonLink>
              ) : null}
              <form action={logout}>
                <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
                <Button type="submit" variant="ghost">
                  {dictionary.header.signOut}
                </Button>
              </form>
            </div>
          ) : (
            <ButtonLink href={`/${locale}/login`} variant="ghost">
              {dictionary.header.signIn}
            </ButtonLink>
          )}
          <LanguageSwitcher locale={locale} labels={dictionary.language} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </div>
    </header>
  );
}
