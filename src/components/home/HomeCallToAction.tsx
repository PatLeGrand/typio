import type { CurrentUser } from "@/auth/types";
import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { HomeTrackScene } from "./HomeTrackScene";
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
    <section data-home-finish className="group/finish relative z-10 bg-background pb-16 pt-36 md:bg-transparent md:pb-[88px] md:pt-48" aria-labelledby="cta-title">
      <span aria-hidden="true" className="absolute left-6 top-0 h-36 border-l-[8px] border-dashed border-accent-text/40 md:hidden" />
      <div className="relative">
        <div aria-hidden="true" className="relative h-[230px] w-full overflow-hidden bg-island-mint sm:h-[260px] 2xl:h-[340px]">
          <HomeTrackScene />
          <div className="absolute inset-0 mx-auto max-w-[960px]">
            {[0, 1, 2].map((index) => <Image key={index} data-finish-racer
              src="/race/blob.svg" alt="" aria-hidden="true" width={52} height={52} loading="lazy"
              className="absolute" style={{ right: 80 + index * 66, bottom: 24 + index * 12, filter: `hue-rotate(${index * 47}deg)` }}
            />)}
          </div>
          <div data-finish-veil aria-hidden="true" className="pointer-events-none absolute inset-0 bg-background opacity-0 transition-[opacity] duration-300 group-hover/finish:opacity-0! group-focus-within/finish:opacity-0! motion-reduce:transition-none" />
        </div>
        <div className="absolute inset-x-0 top-0 mx-auto max-w-[960px]">
          <div data-track-point="finish" aria-hidden="true" className="absolute right-4 top-0 sm:right-8">
            <svg width={60} height={20} viewBox="0 0 60 20" focusable="false" className="absolute -left-[30px] -top-5 hidden md:block">
              <path d="M0 0h60v20H0z" className="fill-background" />
              <path d="M0 0h10v10H0z M20 0h10v10H20z M40 0h10v10H40z M10 10h10v10H10z M30 10h10v10H30z M50 10h10v10H50z" className="fill-foreground" />
            </svg>
            <Image src="/race/finish-post.svg" alt="" width={6} height={114} loading="lazy" className="absolute -left-14 -top-[114px] max-w-none dark:brightness-150 sm:-left-12" />
            <Image data-track-flag src="/race/checkered-flag.svg" alt="" width={66} height={44} loading="lazy" className="absolute -left-14 -top-[114px] max-w-none origin-left sm:-left-12" />
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto -mt-5 max-w-[960px] px-4 sm:px-8">
        <div data-finish-panel className="flex min-w-0 flex-col gap-6 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 max-w-prose flex-col gap-4">
            <h2 id="cta-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
              {home.cta.title}
            </h2>
            <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.cta.description}</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-3 md:max-w-64">
            {canRegister ? (
              <ButtonLink href={`/${locale}/register`} variant="key" size="large">{home.signUp}</ButtonLink>
            ) : (
              <ButtonLink href={`/${locale}/race/settings`} variant="key" size="large">{home.createRace}</ButtonLink>
            )}
            {user === null ? (
              <p className="text-center text-sm text-muted">
                {home.cta.existingAccount}{" "}
                <ButtonLink href={`/${locale}/login`} variant="ghost">
                  {home.signIn}
                </ButtonLink>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
