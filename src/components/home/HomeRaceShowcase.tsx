"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

const RaceVisualizer = dynamic(
  () => import("@/components/race/RaceVisualizer").then((module) => module.RaceVisualizer),
  { ssr: false },
);

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STILL_PROGRESS = [30, 38, 46, 52];
const SPEEDS = [1.14, 1.2, 1.16, 1.17];
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const serverMotionSnapshot = () => true;

export function HomeRaceShowcase({ labels }: { labels: Dictionary["home"]["raceShowcase"] }) {
  const figureRef = useRef<HTMLElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  const [frame, setFrame] = useState({ progress: [0, 0, 0, 0], pauseTicks: 0, tick: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const figure = figureRef.current;
    if (!figure) return;
    let inView = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncTimer = () => {
      clearInterval(timer);
      timer = undefined;
      if (!inView || document.hidden) return;
      timer = setInterval(() => {
        // Five ticks leave a short pause at the finish before the next race.
        setFrame(({ progress, pauseTicks, tick }) => {
          if (progress.some((value) => value >= 100)) {
            return pauseTicks < 4
              ? { progress, pauseTicks: pauseTicks + 1, tick }
              : { progress: progress.map(() => 0), pauseTicks: 0, tick: 0 };
          }
          return {
            progress: progress.map((value, index) => Math.min(100,
              value + SPEEDS[index] + 0.6 * Math.sin(tick * 0.07 + index * Math.PI / 2))),
            pauseTicks: 0, tick: tick + 1,
          };
        });
      }, 200);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncTimer();
    });
    observer.observe(figure);
    document.addEventListener("visibilitychange", syncTimer);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncTimer);
    };
  }, [reducedMotion]);

  return (
    <figure ref={figureRef} className="w-full min-w-0">
      <div aria-hidden="true" className="h-[260px] w-full sm:h-[380px]">
        <RaceVisualizer
          trackLength={1500}
          racers={labels.racers.map((name, index) => ({
            id: `demo-${index}`,
            name,
            progress: (reducedMotion ? STILL_PROGRESS : frame.progress)[index],
            isLocal: index === 0,
            hue: index * 47,
          }))}
          reducedMotion={reducedMotion}
          className="relative h-[260px] w-full overflow-hidden rounded-[28px] border border-border sm:h-[380px]"
        />
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">{labels.caption}</figcaption>
    </figure>
  );
}
