import type { CurrentUser } from "@/auth/types";
import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { HomeSideLane } from "./HomeSideLane";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type HomeCallToActionProps = {
  home: Dictionary["home"];
  locale: Locale;
  user: CurrentUser | null;
};

/** Ligne d'arrivée : le couloir latéral s'achève sur ce damier, trois coureurs le franchissent. */
export function HomeCallToAction({ home, locale, user }: HomeCallToActionProps) {
  const canRegister = user === null || user.kind === "guest";

  return (
    <section data-home-finish className="relative pb-20 md:pb-28" aria-labelledby="cta-title">
      <div aria-hidden="true" className="relative">
        <div className="relative">
          <HomeSideLane runner={false} />
          <div className="home-lane-content relative h-16 md:h-20">
          {[0, 1, 2].map((index) => (
            <Image
              key={index}
              data-finish-racer
              src="/race/blob.svg"
              alt=""
              width={52}
              height={52}
              loading="lazy"
              className="absolute bottom-1 size-10 md:size-13"
              style={{ right: `${18 + index * 12}%`, filter: index ? `hue-rotate(${index * 47}deg)` : undefined }}
            />
          ))}
          </div>
        </div>
        <div className="track-checker h-7 w-full md:h-9" />
      </div>
      <div data-finish-panel className="home-lane-content grid gap-8 pt-12 md:pt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id="cta-title" className="text-balance font-display text-[clamp(2.75rem,8vw,6.5rem)] font-black leading-[0.88] text-foreground">
            {home.cta.title}
          </h2>
          <p className="max-w-[44ch] text-lg leading-relaxed text-muted">{home.cta.description}</p>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-3 lg:items-end">
          {canRegister ? (
            <ButtonLink href={`/${locale}/register`} variant="key" size="large">{home.signUp}</ButtonLink>
          ) : (
            <ButtonLink href={`/${locale}/race/settings`} variant="key" size="large">{home.createRace}</ButtonLink>
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
      </div>
    </section>
  );
}
