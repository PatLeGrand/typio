import type { Dictionary } from "@/i18n/dictionaries";

type HomeWhySectionProps = {
  home: Dictionary["home"];
};

export function HomeWhySection({ home }: HomeWhySectionProps) {
  return (
    <section id="why" className="scroll-mt-24 bg-surface px-4 py-20 sm:px-8 sm:py-24" aria-labelledby="why-title">
      <div className="mx-auto flex max-w-[750px] flex-col items-center gap-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{home.why.eyebrow}</p>
        <h2 id="why-title" className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
          {home.why.title}
        </h2>
        <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.why.description}</p>
      </div>
    </section>
  );
}
