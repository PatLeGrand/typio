import type { Dictionary } from "@/i18n/dictionaries";

type HomeWhySectionProps = {
  home: Dictionary["home"];
};

export function HomeWhySection({ home }: HomeWhySectionProps) {
  return (
    <section id="why" className="relative z-10 scroll-mt-24 py-20 pl-16 pr-6 md:scroll-mt-0 md:px-8 md:py-24" aria-labelledby="why-title">
      <div className="relative mx-auto max-w-[1120px] md:pr-40">
        <span data-track-point aria-hidden="true" className="absolute -top-8 right-20" />
        <span data-track-point aria-hidden="true" className="absolute -bottom-8 right-20" />
        <div className="flex min-w-0 flex-col gap-5 md:max-w-[628px]">
          <h2 id="why-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.why.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.why.description}</p>
        </div>
      </div>
    </section>
  );
}
