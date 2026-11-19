import type { Dictionary } from "@/i18n/dictionaries";

type HomeAboutSectionProps = {
  home: Dictionary["home"];
};

/** La pelouse au centre du stade : le passage calme, adressé aussi aux profs et aux parents. */
export function HomeAboutSection({ home }: HomeAboutSectionProps) {
  return (
    <section className="bg-island-mint py-20 md:py-28" aria-labelledby="about-title">
      <div className="home-lane-content grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <h2 id="about-title" className="text-balance font-display text-[clamp(2.25rem,5vw,3.75rem)] font-black leading-[0.92] text-foreground">
          {home.about.title}
        </h2>
        <div className="flex max-w-prose flex-col gap-6 lg:pt-2">
          <p className="text-xl leading-relaxed text-foreground">{home.about.description}</p>
          <p className="flex items-center gap-3 font-display text-xl font-bold text-foreground">
            <span aria-hidden="true" className="h-1 w-10 shrink-0 bg-track" />
            {home.about.signature}
          </p>
        </div>
      </div>
    </section>
  );
}
