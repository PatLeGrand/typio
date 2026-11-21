"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { HomeTrackScene } from "./HomeTrackScene";

const RaceVisualizer = memo(dynamic(
  () => import("@/components/race/RaceVisualizer").then((module) => module.RaceVisualizer),
  { ssr: false },
));

type HomeLiveSceneProps = {
  labels: Dictionary["home"]["raceShowcase"];
  progress: readonly number[];
  /** Mobile ou mouvement réduit : décor fixe, aucun canvas (PERF-01). */
  still: boolean;
  paused: boolean;
  /** Les coureurs avancent (démo ou essai en cours) : sert d'état observable de la scène. */
  moving: boolean;
  locale: Locale;
  /** Bouton pause, posé sur la scène hors de la zone `aria-hidden`. */
  pauseControl?: ReactNode;
};

/**
 * Course d'essai de l'accueil, pilotée par `playableRace` : bandeau « essai en direct », légende des coureurs,
 * puis la scène PixiJS chargée après le chargement de la page et quand le navigateur est inactif.
 */
export function HomeLiveScene({ labels, progress, still, paused, moving, locale, pauseControl }: HomeLiveSceneProps) {
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  // L'espace initiale sépare le nom du pourcentage pour les lecteurs d'écran.
  const shares = progress.map((value) => ` ${percent.format(value / 100)}`);
  const [ready, setReady] = useState(false);
  const racers = useMemo(() => labels.racers.map((name, index) => ({
    id: `demo-${index}`, name, progress: progress[index], isLocal: index === 0, hue: index * 47,
  })), [labels.racers, progress]);

  useEffect(() => {
    if (ready || still || paused) return;
    let idle: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setReady(true));
      else timeout = setTimeout(() => setReady(true), 200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timeout);
    };
  }, [ready, still, paused]);

  const live = ready && !still;

  return (
    <div data-home-race-track className="race-arena">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 text-xs sm:px-6">
        <p className="flex items-center gap-2.5 font-display text-sm font-bold uppercase tracking-[0.12em]">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-key-coral" />
          {labels.liveTag}
        </p>
        <ul aria-label={labels.gridLabel} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {labels.racers.map((name, index) => (
            <li key={name} data-progress={progress[index]} className={`inline-flex items-center gap-1.5 ${index === 0 ? "font-semibold" : ""}`}>
              <Image src="/race/blob.svg" alt="" width={16} height={16} className="size-4" style={index ? { filter: `hue-rotate(${index * 47}deg)` } : undefined} />
              <span>{name}</span>
              {/* La scène est décorative : la progression reste lisible par les lecteurs d'écran (A11Y-03). */}
              <span className="sr-only">{shares[index]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative">
        <div aria-hidden="true" data-moving={moving} className="relative h-[clamp(250px,30vh,340px)] w-full overflow-hidden bg-island-mint">
          <HomeTrackScene />
          {!live && labels.racers.map((name, index) => (
            <Image
              key={name}
              data-scene-racer
              src="/race/blob.svg"
              alt=""
              width={52}
              height={52}
              className="absolute size-10 sm:size-13"
              style={{ left: `${10 + index * 22}%`, bottom: 20 + index * 12, filter: index ? `hue-rotate(${index * 47}deg)` : undefined }}
            />
          ))}
          {live && <RaceVisualizer trackLength={1500} racers={racers} paused={paused} maxFPS={30} className="absolute inset-0 h-full w-full" />}
        </div>
        {pauseControl}
      </div>
    </div>
  );
}
