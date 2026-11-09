"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { logout } from "@/auth/actions";
import { AUTH_FIELDS, type CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileModal } from "./ProfileModal";

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
    <header className={`md:sticky top-0 z-50 w-full border-b border-border bg-surface transition-[padding] duration-300 motion-reduce:transition-none ${isScrolled ? "md:border-b-0 md:bg-transparent md:pt-4 md:px-4" : ""}`}>
      <div className={`mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 min-h-24 px-4 py-4 transition-[padding,min-height,border-radius,box-shadow,background-color] duration-300 motion-reduce:transition-none ${
        isScrolled
          ? "md:min-h-16 md:rounded-[32px] md:border md:border-border bg-surface md:shadow-sm md:py-2 md:px-8"
          : "md:px-8 lg:px-[88px]"
      }`}>
        <Link href={`/${locale}`} className="rounded-field">
          <Logo name={dictionary.site.name} />
        </Link>
        <nav className="order-3 hidden w-full items-center justify-center gap-8 text-sm text-muted lg:order-none lg:flex lg:w-auto" aria-label={dictionary.navigation.main}>
          <Link href={`/${locale}#why`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.why}</Link>
          <Link href={`/${locale}#video`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.preview}</Link>
          <Link href={`/${locale}#approach`} className="rounded-field hover:text-foreground">{dictionary.home.navigation.approach}</Link>
        </nav>
        <div className="contents md:flex md:min-w-0 md:flex-wrap md:items-center md:justify-end md:gap-2">
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <LanguageSwitcher locale={locale} labels={dictionary.language} compact />
            <ThemeToggle labels={dictionary.theme} compact />
          </div>
          {user ? (
            <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2 md:w-auto">
              <ProfileModal user={user} dictionary={dictionary} locale={locale}>
                <span className="text-sm font-semibold text-foreground flex min-w-0 items-center gap-2">
                  <Avatar name={user.displayName} seed={user.id} userId={user.id} avatarVersion={user.avatarVersion} size={28} />
                  <span className="max-w-24 truncate md:max-w-40">{user.displayName}</span>
                  {user.kind === "guest" ? (
                    <span className="text-xs font-normal text-muted ml-0.5">({dictionary.header.guest})</span>
                  ) : null}
                  <ChevronDown aria-hidden="true" className="size-4 opacity-50" />
                </span>
              </ProfileModal>
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
            <div className="flex w-full items-center justify-end gap-2 md:w-auto">
              <ButtonLink href={`/${locale}/login`} variant="ghost" compactOnMobile>
                {dictionary.header.signIn}
              </ButtonLink>
              <ButtonLink href={`/${locale}/register`} compactOnMobile>{dictionary.header.signUp}</ButtonLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
