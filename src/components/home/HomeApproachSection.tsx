import type { Dictionary } from "@/i18n/dictionaries";

type HomeApproachSectionProps = {
  home: Dictionary["home"];
};

export function HomeApproachSection({ home }: HomeApproachSectionProps) {
  return (
    <section id="approach" className="scroll-mt-24 bg-accent-panel px-4 py-16 sm:px-8 sm:py-[88px]" aria-labelledby="approach-title">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col gap-12 sm:gap-14">
        <div className="flex max-w-[750px] flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{home.approach.eyebrow}</p>
          <h2 id="approach-title" className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.approach.title}
          </h2>
        </div>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-16">
          {home.approach.steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-[18px]">
              <span className="text-sm text-accent-text">{String(index + 1).padStart(2, "0")}</span>
              <span className="h-px w-full bg-border" aria-hidden="true" />
              <h3 className="text-2xl font-medium text-foreground sm:text-[26px]">{step.title}</h3>
              <p className="text-base leading-[1.65] text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
