import type { Dictionary } from "@/i18n/dictionaries";

type HomeAboutSectionProps = {
  home: Dictionary["home"];
};

export function HomeAboutSection({ home }: HomeAboutSectionProps) {
  return (
    <section className="relative z-10 py-16 pl-16 pr-6 md:px-8 md:py-24" aria-labelledby="about-title">
      <div className="relative mx-auto max-w-[1120px] md:pr-40">
        <span data-track-point aria-hidden="true" className="absolute -top-8 right-20" />
        <span data-track-point aria-hidden="true" className="absolute -bottom-8 right-20" />
        <div className="flex min-w-0 flex-col gap-7 md:max-w-[628px]">
          <h2 id="about-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.about.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.about.description}</p>
          <p className="font-medium text-foreground">{home.about.signature}</p>
        </div>
      </div>
    </section>
  );
}
