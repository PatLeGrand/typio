import type { Dictionary } from "@/i18n/dictionaries";

type HomeAboutSectionProps = {
  home: Dictionary["home"];
};

export function HomeAboutSection({ home }: HomeAboutSectionProps) {
  return (
    <section className="bg-surface px-4 py-16 sm:px-8 sm:py-[104px]" aria-labelledby="about-title">
      <div className="mx-auto grid w-full max-w-[1264px] gap-10 lg:grid-cols-[480px_1fr] lg:gap-28">
        <div className="flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{home.about.eyebrow}</p>
          <h2 id="about-title" className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.about.title}
          </h2>
        </div>
        <div className="flex flex-col gap-7">
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.about.description}</p>
          <p className="font-medium text-foreground">{home.about.signature}</p>
        </div>
      </div>
    </section>
  );
}
