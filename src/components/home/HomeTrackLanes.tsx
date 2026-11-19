import Image from "next/image";
import type { Locale } from "@/i18n/config";

type HomeTrackLanesProps = {
  racers: ReadonlyArray<{ name: string; progress: number }>;
  moving: boolean;
  locale: Locale;
};

/**
 * Piste d'athlétisme vue de dessus : un couloir par coureur, ligne de départ, damier d'arrivée.
 * Décor pur (`aria-hidden`) : la progression lisible reste dans le panneau de saisie (A11Y-03).
 */
export function HomeTrackLanes({ racers, moving, locale }: HomeTrackLanesProps) {
  const number = new Intl.NumberFormat(locale);

  return (
    <div aria-hidden="true" className="track-surface relative select-none overflow-hidden border-y-[6px] border-track-shade">
      {racers.map((racer, index) => (
        <div
          key={racer.name}
          className={`relative flex h-12 items-center sm:h-14 lg:h-[68px] ${index ? "border-t-2 border-track-line" : ""} ${index === 0 ? "bg-accent" : index % 2 ? "bg-track-shade/60" : ""}`}
        >
          <span className="w-8 shrink-0 text-center font-display text-3xl font-black leading-none text-track-line sm:w-16 sm:text-5xl lg:w-20 lg:text-6xl">
            {number.format(index + 1)}
          </span>
          <span className="w-[5.5rem] shrink-0 truncate pr-2 font-display text-xs font-bold uppercase tracking-[0.06em] text-track-line sm:tracking-[0.14em] sm:w-32 sm:text-base">
            {racer.name}
          </span>
          {/* Le couloir utile va de la ligne de départ au damier : `left` y est un pourcentage de course. */}
          <div className="absolute inset-y-0 left-[8.5rem] right-6 sm:left-[13rem] md:right-24 lg:left-[14rem]">
            <span className="home-runner-trail absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_8px,transparent_8px_14px)] opacity-70" style={{ width: `${racer.progress}%` }} />
            <span data-moving={moving} className="home-runner absolute top-1/2 block -translate-x-1/2 -translate-y-1/2" style={{ left: `${racer.progress}%` }}>
              <Image
                src="/race/blob.svg"
                alt=""
                width={44}
                height={44}
                priority={index === 0}
                className="size-8 sm:size-10 lg:size-11"
                style={index ? { filter: `hue-rotate(${index * 47}deg)` } : undefined}
              />
            </span>
          </div>
        </div>
      ))}
      <span className="absolute inset-y-0 left-[8.5rem] w-1 -translate-x-1/2 bg-track-line sm:left-[13rem] lg:left-[14rem]" />
      <span className="track-checker absolute inset-y-0 right-6 w-3.5 translate-x-full sm:w-7 md:right-24" />
    </div>
  );
}
