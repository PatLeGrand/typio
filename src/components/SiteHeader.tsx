"use client";

import { useState, useEffect } from "react";
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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? "pt-2 px-2 sm:pt-4 sm:px-4" : "bg-surface border-b border-border"}`}>
      <div className={`mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 transition-all duration-300 ${
        isScrolled 
          ? "min-h-16 rounded-[32px] border border-border bg-surface/85 backdrop-blur-md shadow-sm px-4 py-2 sm:px-8" 
          : "min-h-24 px-4 py-4 sm:px-8 lg:px-[88px]"
      }`}>
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
