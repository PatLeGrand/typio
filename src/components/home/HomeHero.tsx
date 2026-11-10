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
    <section className="min-w-0 bg-background pb-10 pt-8 sm:pt-10" aria-labelledby="home-title">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 px-4 md:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:px-[88px]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pb-6">
          <h1
            id="home-title"
            aria-label={`${home.hero.titleLine1} ${home.hero.titleLine2}`}
            className="text-balance text-[42px] font-medium leading-[1.08] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[clamp(48px,4.7vw,80px)]"
          >
            <span className="block">{home.hero.titleLine1}</span>
            <span className="block">{home.hero.titleLine2}</span>
          </h1>
        </div>
        <div className="min-w-0 space-y-3 pt-6 lg:col-start-2 lg:row-start-1 lg:pb-6 lg:pt-0">
          <p className="max-w-prose text-base leading-relaxed text-muted">{home.hero.description}</p>
          <div className="flex min-w-0 flex-col items-start gap-3 2xl:flex-row 2xl:items-end">
            <div className="shrink-0"><ButtonLink href={`/${locale}/race/settings`}>{home.createRace}</ButtonLink></div>
            <HomeJoinCodeForm labels={home.joinByCode} locale={locale} />
          </div>
        </div>
      </div>
      <div className="mt-6 min-w-0 lg:mt-0">
        <HomeRaceShowcase labels={home.raceShowcase} playable={{ ...home.playableRace, keyboard: keyboardLabel }} locale={locale} />
      </div>
    </section>
  );
}
