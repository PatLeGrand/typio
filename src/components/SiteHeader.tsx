"use client";

import { useState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CornerDownLeft, Menu, X } from "lucide-react";
import { logout } from "@/auth/actions";
import { AUTH_FIELDS, type CurrentUser } from "@/auth/types";
import type { Locale } from "@/i18n/config";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileModal } from "./ProfileModal";
import type { SiteHeaderDictionary } from "./siteHeaderDictionary";

type SiteHeaderProps = {
  locale: Locale;
  dictionary: SiteHeaderDictionary;
  /** Utilisateur connecté (membre ou invité), ou `null` pour un visiteur. */
  user: CurrentUser | null;
};

export function SiteHeader({ locale, dictionary, user }: SiteHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  // Même seuil que l'affichage de la navigation dans la barre : au-delà, le panneau n'a plus lieu d'être.
  const desktopQuery = user ? "(min-width: 1280px)" : "(min-width: 1024px)";

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--site-header-height", `${header.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-header-height");
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(desktopQuery);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [desktopQuery]);

  useEffect(() => {
    if (!menuOpen) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const navLinks = (className: string) => (
    <>
      <Link href={`/${locale}#why`} className={className}>{dictionary.home.navigation.why}</Link>
      <Link href={`/${locale}#video`} className={className}>{dictionary.home.navigation.preview}</Link>
      <Link href={`/${locale}#approach`} className={className}>{dictionary.home.navigation.approach}</Link>
    </>
  );

  const memberActions = user ? (
    <>
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
    </>
  ) : null;

  return (
    <header ref={headerRef} className={`md:sticky top-0 z-50 w-full border-b border-border bg-surface transition-[padding] duration-300 motion-reduce:transition-none ${isScrolled ? "md:border-b-0 md:bg-transparent md:pt-4 md:px-4" : ""}`}>
      <div className={`mx-auto flex w-full max-w-[1440px] items-center justify-between gap-x-3 min-h-24 px-4 py-4 transition-[padding,min-height,border-radius,box-shadow,background-color] duration-300 motion-reduce:transition-none ${
        isScrolled
          ? "md:min-h-16 md:rounded-[32px] md:border md:border-border bg-surface md:shadow-sm md:py-2 md:pl-8 md:pr-2.5"
          : "md:px-8 xl:px-[88px]"
      }`}>
        <Link href={`/${locale}`} className="shrink-0 rounded-field">
          <Logo name={dictionary.site.name} />
        </Link>
        <nav className={`hidden items-center justify-center gap-8 text-sm text-muted ${user ? "xl:flex" : "lg:flex"}`} aria-label={dictionary.navigation.main}>
          {navLinks("road-link rounded-field hover:text-foreground")}
        </nav>
        <div className="flex min-w-0 items-center justify-end gap-1 md:gap-2">
          <div className="flex items-center gap-1">
            <LanguageSwitcher locale={locale} labels={dictionary.language} compact />
            <ThemeToggle labels={dictionary.theme} />
          </div>
          {user ? (
            <div className="flex min-w-0 items-center justify-end gap-2">
              <ProfileModal user={user} dictionary={dictionary} locale={locale}>
                <span className="text-sm font-semibold text-foreground flex min-h-11 min-w-0 items-center gap-2">
                  <Avatar name={user.displayName} seed={user.id} userId={user.id} avatarVersion={user.avatarVersion} size={28} />
                  <span className={`sr-only sm:not-sr-only ${user.kind === "guest" ? "max-w-24 truncate" : "max-w-24 truncate md:max-w-40"}`}>{user.displayName}</span>
                  {user.kind === "guest" ? (
                    <span className="sr-only text-xs font-normal text-muted ml-0.5 sm:not-sr-only">({dictionary.header.guest})</span>
                  ) : null}
                  <ChevronDown aria-hidden="true" className="size-4 opacity-50" />
                </span>
              </ProfileModal>
              <div className="hidden items-center gap-2 xl:flex">{memberActions}</div>
            </div>
          ) : (
            <div className="hidden items-center justify-end gap-2 lg:flex">
              <ButtonLink href={`/${locale}/login`} variant="ghost" compactOnMobile>
                {dictionary.header.signIn}
              </ButtonLink>
              <ButtonLink href={`/${locale}/register`} variant="key" compactOnMobile
                className={`md:transition-[transform,translate,box-shadow,background-color,color,border-radius] md:duration-[100ms,100ms,100ms,100ms,100ms,300ms] md:motion-reduce:transition-none ${isScrolled ? "md:rounded-full" : ""}`}>
                {dictionary.header.signUp}
                <CornerDownLeft aria-hidden="true" className="hidden size-4 sm:block" />
              </ButtonLink>
            </div>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? dictionary.header.closeMenu : dictionary.header.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground ${user ? "xl:hidden" : "lg:hidden"}`}
          >
            {menuOpen ? <X aria-hidden="true" className="size-[18px]" /> : <Menu aria-hidden="true" className="size-[18px]" />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div
          ref={panelRef}
          id={menuId}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) setMenuOpen(false);
          }}
          className={`border-t border-border bg-surface px-4 pb-4 md:px-8 ${user ? "xl:hidden" : "lg:hidden"}`}
        >
          <nav aria-label={dictionary.navigation.main} className="flex flex-col text-sm text-muted">
            {navLinks("flex min-h-11 items-center rounded-field hover:text-foreground")}
          </nav>
          <div className="mt-2 flex flex-col items-stretch gap-2 border-t border-border pt-3">
            {user ? (
              memberActions
            ) : (
              <>
                <ButtonLink href={`/${locale}/login`} variant="ghost">
                  {dictionary.header.signIn}
                </ButtonLink>
                <ButtonLink href={`/${locale}/register`} variant="key">
                  {dictionary.header.signUp}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
