import Image from "next/image";
import type { Dictionary } from "@/i18n/dictionaries";

type HomeApproachSectionProps = {
  home: Dictionary["home"];
};

/** Les étapes sont les relais d'une même piste : départs décalés, témoin passé d'un coureur à l'autre. */
const STAGGER = ["lg:pt-10", "lg:pt-20", "lg:pt-30"];

export function HomeApproachSection({ home }: HomeApproachSectionProps) {
  return (
    <section id="approach" className="scroll-mt-24 pb-20 md:pb-28" aria-labelledby="approach-title">
      <div className="home-lane-content pb-8">
        <h2 id="approach-title" className="text-balance font-display text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.9] text-foreground">
          {home.approach.title}
        </h2>
      </div>
      <div className="track-surface relative border-y-[6px] border-track-shade">
        <ol className="home-lane-content grid lg:grid-cols-3">
          {home.approach.steps.map((step, index) => (
            <li
              key={step.title}
              className={`relative flex min-w-0 flex-col gap-3 border-track-line py-8 pr-2 lg:min-h-80 lg:border-l-2 lg:px-8 lg:pb-12 ${index ? "border-t-2 lg:border-t-0" : ""} ${STAGGER[index] ?? ""}`}
            >
              <span aria-hidden="true" className="absolute -top-px left-0 hidden h-1 w-16 bg-track-line lg:block" />
              <Image
                src="/race/blob.svg"
                alt=""
                aria-hidden="true"
                width={44}
                height={44}
                loading="lazy"
                className="absolute right-2 top-6 size-9 lg:-left-[18px] lg:right-auto lg:top-auto lg:bottom-6"
                style={index ? { filter: `hue-rotate(${index * 47}deg)` } : undefined}
              />
              <h3 className="max-w-[16ch] text-balance pr-12 font-display text-3xl font-black leading-none text-track-line sm:text-4xl lg:pr-0">{step.title}</h3>
              <p className="max-w-[34ch] text-base leading-relaxed text-track-line">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
