import { ButtonLink } from "@/components/ButtonLink";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { HomeMediaPlaceholder } from "./HomeMediaPlaceholder";

type HomeHeroProps = {
  home: Dictionary["home"];
  locale: Locale;
};

export function HomeHero({ home, locale }: HomeHeroProps) {
  return (
    <section className="bg-surface px-4 pb-10 pt-16 sm:px-8 sm:pt-20" aria-labelledby="home-title">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col items-center gap-12 sm:gap-[52px]">
        <div className="flex max-w-[800px] flex-col items-center gap-6 text-center">
          <h1
            id="home-title"
            aria-label={`${home.hero.titleLine1} ${home.hero.titleLine2}`}
            className="text-[42px] font-medium leading-[1.08] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[64px]"
          >
            <span className="block">{home.hero.titleLine1}</span>
            <span className="block">{home.hero.titleLine2}</span>
          </h1>
          <p className="max-w-[610px] text-base leading-[1.65] text-muted sm:text-lg">{home.hero.description}</p>
          <div className="flex w-full flex-col justify-center gap-3 pt-1 sm:w-auto sm:flex-row sm:gap-4">
            <ButtonLink href={`/${locale}/play`}>{home.createRace}</ButtonLink>
            <ButtonLink variant="secondary" href={`/${locale}/play`}>
              {home.joinWithCode}
            </ButtonLink>
          </div>
        </div>
        <HomeMediaPlaceholder
          kind="image"
          label={home.media.imageLabel}
          title={home.media.heroTitle}
          description={home.media.heroDescription}
          note={home.media.replaceable}
          className="w-full"
        />
      </div>
    </section>
  );
}
