import Link from "next/link";
import type { CurrentUser } from "@/auth/types";
import { Logo } from "@/components/Logo";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type HomeFooterProps = {
  dictionary: Dictionary;
  locale: Locale;
  user: CurrentUser | null;
};

export function HomeFooter({ dictionary, locale, user }: HomeFooterProps) {
  const { footer, home, site, brand } = dictionary;

  return (
    <footer className="bg-background px-4 pb-8 pt-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col gap-10">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="flex flex-col items-start gap-4">
            <Logo name={site.name} />
            <p className="text-sm text-muted">{brand.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-12 text-sm sm:gap-24">
            <nav aria-label={home.navigation.preview} className="flex flex-col gap-3 text-muted">
              <p className="font-semibold text-foreground">{home.navigation.preview}</p>
              <Link href="#why" className="hover:text-foreground">{home.navigation.why}</Link>
              <Link href="#preview" className="hover:text-foreground">{home.navigation.preview}</Link>
              <Link href="#approach" className="hover:text-foreground">{home.navigation.approach}</Link>
            </nav>
            <nav aria-label={dictionary.header.signIn} className="flex flex-col gap-3 text-muted">
              <p className="font-semibold text-foreground">{dictionary.header.signIn}</p>
              {user === null ? (
                <Link href={`/${locale}/login`} className="hover:text-foreground">{home.signIn}</Link>
              ) : null}
              {user === null || user.kind === "guest" ? (
                <Link href={`/${locale}/register`} className="hover:text-foreground">{home.signUp}</Link>
              ) : null}
            </nav>
          </div>
        </div>
        <div className="h-px bg-border" aria-hidden="true" />
        <div className="flex flex-col justify-between gap-3 text-xs text-muted sm:flex-row">
          <p>{footer.copyright}</p>
          <Link href={`/${locale}/privacy`} className="rounded-field hover:text-foreground">{footer.privacy}</Link>
        </div>
      </div>
    </footer>
  );
}
