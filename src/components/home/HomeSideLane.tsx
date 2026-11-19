import Image from "next/image";

/**
 * Couloir vertical qui relie la piste du haut au damier d'arrivée. Le coureur est collant :
 * il suit le défilement sans aucune animation ni script, et s'arrête au bout du couloir.
 */
export function HomeSideLane({ runner = true }: { runner?: boolean }) {
  return (
    <div aria-hidden="true" className="track-surface pointer-events-none absolute inset-y-0 left-3 w-8 border-x-2 border-track-line md:left-8 md:w-14">
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[repeating-linear-gradient(180deg,var(--track-line)_0_10px,transparent_10px_22px)] opacity-60" />
      {runner && <div className="sticky top-[55vh] flex justify-center py-3">
        <Image src="/race/blob.svg" alt="" width={44} height={44} loading="lazy" className="size-7 md:size-11" />
      </div>}
    </div>
  );
}
