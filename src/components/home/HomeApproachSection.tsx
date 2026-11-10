import type { Dictionary } from "@/i18n/dictionaries";

type HomeApproachSectionProps = {
  home: Dictionary["home"];
};

export function HomeApproachSection({ home }: HomeApproachSectionProps) {
  return (
    <section id="approach" className="relative z-10 scroll-mt-24 py-16 pl-16 pr-6 md:scroll-mt-0 md:px-8 md:py-24" aria-labelledby="approach-title">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 md:gap-24">
        <div className="relative md:pr-40">
          <span data-track-point aria-hidden="true" className="absolute -top-8 right-20" />
          <span data-track-point aria-hidden="true" className="absolute -bottom-8 right-20" />
          <h2 id="approach-title" className="text-balance text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px] md:max-w-[628px]">
            {home.approach.title}
          </h2>
        </div>
        <ol className="flex flex-col gap-16 md:gap-24">
          {home.approach.steps.map((step, index) => (
            <li key={step.title} className={`relative ${index % 2 === 0 ? "md:pl-40" : "md:pr-40"}`}>
              <span data-track-point aria-hidden="true" className={`absolute -top-8 ${index % 2 === 0 ? "left-20" : "right-20"}`} />
              <span data-track-point aria-hidden="true" className={`absolute -bottom-8 ${index % 2 === 0 ? "left-20" : "right-20"}`} />
              <div className={`flex min-w-0 flex-col gap-4 md:max-w-[628px] ${index % 2 === 0 ? "md:ml-auto" : ""}`}>
                <h3 className="text-balance text-2xl font-medium text-foreground sm:text-[26px]">{step.title}</h3>
                <p className="text-base leading-[1.65] text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
