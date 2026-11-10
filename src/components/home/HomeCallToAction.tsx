import type { CurrentUser } from "@/auth/types";
import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type HomeCallToActionProps = {
  home: Dictionary["home"];
  locale: Locale;
  user: CurrentUser | null;
};

export function HomeCallToAction({ home, locale, user }: HomeCallToActionProps) {
  const canRegister = user === null || user.kind === "guest";

  return (
    <section className="relative z-10 bg-background pb-16 pl-16 pr-6 pt-36 md:bg-transparent md:px-8 md:pb-[88px] md:pt-48" aria-labelledby="cta-title">
      <span aria-hidden="true" className="absolute left-6 top-0 h-16 border-l-[8px] border-dashed border-accent-text/40 md:hidden" />
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-6 rounded-[28px] bg-island-sand px-6 py-14 text-center sm:px-12 sm:py-16 md:relative">
        <div data-track-point="finish" aria-hidden="true" className="absolute left-6 top-16 md:left-1/2 md:top-0 md:z-10">
          <svg width={60} height={20} viewBox="0 0 60 20" focusable="false" className="absolute -left-[30px] -top-5 hidden md:block">
            <path d="M0 0h60v20H0z" className="fill-background" />
            <path d="M0 0h10v10H0z M20 0h10v10H20z M40 0h10v10H40z M10 10h10v10H10z M30 10h10v10H30z M50 10h10v10H50z" className="fill-foreground" />
          </svg>
          <Image src="/race/finish-post.svg" alt="" width={6} height={114} className="absolute -left-1 -top-16 max-w-none dark:brightness-150 md:left-12 md:-top-[114px]" />
          <Image data-track-flag src="/race/checkered-flag.svg" alt="" width={66} height={44} className="absolute -left-1 -top-16 max-w-none origin-left md:left-12 md:-top-[114px]" />
        </div>
        <div className="flex max-w-[700px] flex-col gap-4">
          <h2 id="cta-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.cta.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.cta.description}</p>
        </div>
        {canRegister ? (
          <ButtonLink href={`/${locale}/register`}>{home.signUp}</ButtonLink>
        ) : (
          <ButtonLink href={`/${locale}/race/settings`}>{home.createRace}</ButtonLink>
        )}
        {user === null ? (
          <p className="text-sm text-muted">
            {home.cta.existingAccount}{" "}
            <ButtonLink href={`/${locale}/login`} variant="ghost">
              {home.signIn}
            </ButtonLink>
          </p>
        ) : null}
      </div>
    </section>
  );
}
