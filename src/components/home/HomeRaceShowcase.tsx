"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";

const RaceVisualizer = dynamic(
  () => import("@/components/race/RaceVisualizer").then((module) => module.RaceVisualizer),
  { ssr: false },
);

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SPEEDS = [1.14, 1.2, 1.16, 1.17];
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const serverMotionSnapshot = () => true;

export function HomeRaceShowcase({ labels, locale }: { labels: Dictionary["home"]["raceShowcase"]; locale: Locale }) {
  const figureRef = useRef<HTMLElement>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  const physicalKeyboard = usePhysicalKeyboard();
  const still = reducedMotion || !physicalKeyboard;
  const [activity, setActivity] = useState({ inView: false, hidden: true });
  const [ready, setReady] = useState(false);
  const paused = !activity.inView || activity.hidden;
  const [frame, setFrame] = useState({ progress: [0, 0, 0, 0], pauseTicks: 0, tick: 0 });

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    let inView = false;
    const syncActivity = () => setActivity({ inView, hidden: document.hidden });
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncActivity();
    });
    observer.observe(figure);
    document.addEventListener("visibilitychange", syncActivity);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncActivity);
    };
  }, []);

  useEffect(() => {
    if (ready || still || paused) return;
    let idle: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idle = window.requestIdleCallback(() => setReady(true));
      } else {
        timeout = setTimeout(() => setReady(true), 200);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timeout);
    };
  }, [ready, still, paused]);

  useEffect(() => {
    if (!ready || still || paused) return;
    const timer = setInterval(() => {
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
    return () => clearInterval(timer);
  }, [ready, still, paused]);

  return (
    <figure ref={figureRef} className="w-full min-w-0">
      <div aria-hidden="true" className="relative h-[260px] w-full overflow-hidden rounded-[28px] border border-border bg-island-mint sm:h-[380px]">
        <Image
          src={`/home/race-showcase-${locale}-light.webp`}
          alt=""
          width={756}
          height={518}
          sizes="(min-width: 1328px) 1264px, calc(100vw - 32px)"
          className="block h-full w-full object-cover dark:hidden"
        />
        <Image
          src={`/home/race-showcase-${locale}-dark.webp`}
          alt=""
          width={756}
          height={518}
          sizes="(min-width: 1328px) 1264px, calc(100vw - 32px)"
          className="hidden h-full w-full object-cover dark:block"
        />
        {ready && !still && <RaceVisualizer
          trackLength={1500}
          racers={labels.racers.map((name, index) => ({
            id: `demo-${index}`,
            name,
            progress: frame.progress[index],
            isLocal: index === 0,
            hue: index * 47,
          }))}
          paused={paused}
          maxFPS={30}
          className="absolute inset-0 h-full w-full"
        />}
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">{labels.caption}</figcaption>
    </figure>
  );
}
