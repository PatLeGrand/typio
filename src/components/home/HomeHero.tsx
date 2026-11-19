import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { HomeRaceShowcase } from "./HomeRaceShowcase";
import { HomeJoinCodeForm } from "./HomeJoinCodeForm";

type HomeHeroProps = {
  home: Dictionary["home"];
  locale: Locale;
  keyboardLabel: string;
};

export function HomeHero({ home, locale, keyboardLabel }: HomeHeroProps) {
  return (
    <section className="min-w-0 pb-12 pt-6 sm:pt-10" aria-labelledby="home-title">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-x-12 gap-y-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:pb-10 xl:px-[88px]">
        <h1
          id="home-title"
          aria-label={`${home.hero.titleLine1} ${home.hero.titleLine2}`}
          className="min-w-0 text-balance font-display text-[clamp(3.25rem,13vw,4.75rem)] font-black leading-[0.86] tracking-[-0.01em] text-foreground sm:text-[clamp(4.75rem,9vw,7.5rem)]"
        >
          <span className="block">{home.hero.titleLine1}</span>
          <span className="block text-accent-text dark:text-key-yellow">{home.hero.titleLine2}</span>
        </h1>
        <div className="flex min-w-0 flex-col gap-5 lg:pb-2">
          <p className="max-w-[34ch] text-pretty text-lg leading-snug text-muted sm:text-xl">{home.hero.description}</p>
          <div className="min-w-0 max-w-full"><ButtonLink href={`/${locale}/race/settings`} variant="start">{home.createRace}</ButtonLink></div>
          <div className="max-w-md">
            <HomeJoinCodeForm labels={home.joinByCode} locale={locale} />
          </div>
        </div>
      </div>
      <HomeRaceShowcase labels={home.raceShowcase} playable={{ ...home.playableRace, keyboard: keyboardLabel }} locale={locale} />
    </section>
  );
}
