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
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-24 w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-4 sm:px-8 lg:px-[88px]">
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} />
        </Link>
        <nav className="order-3 hidden w-full items-center justify-center gap-8 text-sm text-muted lg:order-none lg:flex lg:w-auto" aria-label={dictionary.home.navigation.preview}>
          <Link href={`/${locale}#why`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.why}</Link>
          <Link href={`/${locale}#preview`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.preview}</Link>
          <Link href={`/${locale}#approach`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.approach}</Link>
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LanguageSwitcher locale={locale} labels={dictionary.language} compact />
          <ThemeToggle labels={dictionary.theme} compact />
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
            <>
              <ButtonLink href={`/${locale}/login`} variant="ghost">
                {dictionary.header.signIn}
              </ButtonLink>
              <ButtonLink href={`/${locale}/register`}>{dictionary.header.signUp}</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
