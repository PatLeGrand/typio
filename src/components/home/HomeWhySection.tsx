import type { Dictionary } from "@/i18n/dictionaries";

type HomeWhySectionProps = {
  home: Dictionary["home"];
};

export function HomeWhySection({ home }: HomeWhySectionProps) {
  return (
    <section id="why" className="scroll-mt-24 py-20 md:py-28" aria-labelledby="why-title">
      <div className="home-lane-content grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end lg:gap-12">
        <h2 id="why-title" className="text-balance font-display text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.9] text-foreground">
          {home.why.title}
        </h2>
        <p className="max-w-[38ch] border-t-4 border-track pt-4 text-lg leading-relaxed text-muted">{home.why.description}</p>
      </div>
    </section>
  );
}
