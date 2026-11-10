"use client";

import { MediaPlaybackButton } from "./MediaPlaybackButton";
import dynamic from "next/dynamic";
import Image from "next/image";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type SyntheticEvent } from "react";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";
import { createPlayableRace, playableRaceProgress, playableRaceResult, transitionPlayableRace } from "./playableRace";

const RaceVisualizer = memo(dynamic(
  () => import("@/components/race/RaceVisualizer").then((module) => module.RaceVisualizer),
  { ssr: false },
));

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SPEEDS = [1.14, 1.2, 1.16, 1.17];
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const serverMotionSnapshot = () => true;
const subscribeHydration = () => () => {};
const hydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

export function HomeRaceShowcase({ labels, playable, locale }: {
  labels: Dictionary["home"]["raceShowcase"];
  playable: Dictionary["home"]["playableRace"] & { keyboard: string };
  locale: Locale;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [race, setRace] = useState(() => createPlayableRace(playable.texts[0]));
  const raceRef = useRef(race);
  const lastTick = useRef<number | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  const physicalKeyboard = usePhysicalKeyboard();
  const hydrated = useSyncExternalStore(subscribeHydration, hydrationSnapshot, serverHydrationSnapshot);
  const still = reducedMotion || !physicalKeyboard;
  const [activity, setActivity] = useState({ inView: false, hidden: true });
  const [ready, setReady] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const paused = userPaused || !activity.inView || activity.hidden;
  const [frame, setFrame] = useState({ progress: [0, 0, 0, 0], pauseTicks: 0, tick: 0 });
  const racers = useMemo(() => labels.racers.map((name, index) => ({
    id: `demo-${index}`, name, progress: frame.progress[index], isLocal: index === 0, hue: index * 47,
  })), [labels.racers, frame.progress]);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const result = playableRaceResult(race);

  function reset(randomize = false) {
    const text = randomize ? playable.texts[Math.floor(Math.random() * playable.texts.length)] : raceRef.current.text;
    const next = createPlayableRace(text);
    raceRef.current = next;
    setRace(next);
    setFrame({ progress: [0, 0, 0, 0], pauseTicks: 0, tick: 0 });
    composing.current = false;
    setDraft(null);
  }

  function elapsed() {
    const now = performance.now();
    const delta = lastTick.current === null ? 0 : now - lastTick.current;
    lastTick.current = now;
    return delta;
  }

  function type(value: string) {
    if (!activity.inView || activity.hidden || !physicalKeyboard) return;
    if (userPaused) setUserPaused(false);
    const previous = raceRef.current;
    const next = transitionPlayableRace(previous, { type: "input", value, deltaMs: elapsed() });
    raceRef.current = next;
    setRace(next);
    if (previous.phase === "waiting" && next.phase !== "waiting") {
      setFrame({ progress: [0, 0, 0, 0], pauseTicks: 0, tick: 0 });
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (composing.current || (event.nativeEvent as InputEvent).isComposing) setDraft(event.target.value);
    else type(event.target.value);
  }

  function keepCaretAtEnd(event: SyntheticEvent<HTMLInputElement>) {
    if (composing.current) return;
    const field = event.currentTarget;
    const end = field.value.length;
    if (field.selectionStart !== end || field.selectionEnd !== end) field.setSelectionRange(end, end);
  }

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    let inView = false;
    const syncActivity = () => {
      // Comptabiliser la dernière fraction de seconde avant une pause.
      if (lastTick.current !== null) {
        const now = performance.now();
        const next = transitionPlayableRace(raceRef.current, { type: "tick", deltaMs: now - lastTick.current });
        raceRef.current = next;
        setRace(next);
        lastTick.current = now;
      }
      setActivity({ inView, hidden: document.hidden });
    };
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
    if (!ready || still || paused || race.phase !== "waiting") return;
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
  }, [ready, still, paused, race.phase]);

  useEffect(() => {
    if (paused || !physicalKeyboard || race.phase !== "racing") return;
    lastTick.current = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const next = transitionPlayableRace(raceRef.current, { type: "tick", deltaMs: now - lastTick.current! });
      lastTick.current = now;
      raceRef.current = next;
      setRace(next);
      setFrame({ progress: playableRaceProgress(next), pauseTicks: 0, tick: 0 });
    }, 100);
    return () => { clearInterval(timer); lastTick.current = null; };
  }, [paused, physicalKeyboard, race.phase]);

  useEffect(() => {
    if (race.phase === "finished") resultRef.current?.focus({ preventScroll: true });
  }, [race.phase]);

  return (
    <figure ref={figureRef} className="relative w-full min-w-0" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        reset();
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    }} onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("[data-home-typing], [data-home-race-track]") && !event.target.closest("button, a, input, progress")) inputRef.current?.focus();
    }}>
      <div className="relative">
        <div data-home-race-track aria-hidden="true" className="relative h-[230px] w-full overflow-hidden bg-island-mint sm:h-[260px]">
          <Image
            src={`/home/race-showcase-${locale}-light.webp`}
            alt=""
            fetchPriority="high"
            width={756}
            height={518}
            sizes="100vw"
            className="block h-full w-full object-cover md:hidden dark:hidden"
          />
          <Image
            src={`/home/race-showcase-${locale}-dark.webp`}
            alt=""
            fetchPriority="high"
            width={756}
            height={518}
            sizes="100vw"
            className="hidden h-full w-full object-cover md:hidden dark:block dark:md:hidden"
          />
          <div className="absolute inset-0 hidden md:block dark:brightness-50 dark:saturate-50"
            style={{ backgroundImage: "url('/race/track.svg'), url('/race/meadow.svg'), url('/race/meadow-distant.svg')", backgroundRepeat: "repeat-x", backgroundPosition: "left bottom, left bottom 80px, left bottom 110px", backgroundSize: "1440px 110px, 1440px 120px, 1440px 208px" }} />
          {(still || !ready) && labels.racers.map((name, index) => <Image key={name}
            src="/race/blob.svg" alt="" aria-hidden="true" width={52} height={52}
            className="absolute hidden md:block"
            style={{ left: `${18 + index * 20}%`, bottom: 24 + index * 14, filter: `hue-rotate(${index * 47}deg)` }}
          />)}
          {ready && !still && <RaceVisualizer
            trackLength={1500}
            racers={racers}
            paused={paused}
            maxFPS={30}
            className="absolute inset-0 h-full w-full"
          />}
        </div>
      </div>
      {!still && <div className="pointer-events-none absolute inset-x-0 top-0 h-[210px] sm:h-[240px]">
        <div className="pointer-events-auto">
          <MediaPlaybackButton playing={!userPaused} label={userPaused ? labels.resume : labels.pause}
            onClick={() => {
              if (!userPaused) {
                const next = transitionPlayableRace(raceRef.current, { type: "tick", deltaMs: elapsed() });
                raceRef.current = next;
                setRace(next);
              }
              setUserPaused((value) => !value);
            }} />
        </div>
      </div>}
      <div className="relative z-10 mx-auto -mt-5 max-w-[960px] px-4 sm:px-8">
        <div data-home-typing className="rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5 md:min-h-[204px]">
          {!physicalKeyboard ? <div className={hydrated ? undefined : "md:invisible"}>
            <p className="max-w-prose text-sm text-muted">{playable.keyboard}</p>
          </div> : <>
            {reducedMotion && <div role="group" aria-label={playable.progress} className="mb-4 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {labels.racers.map((name, index) => <label key={name} className="flex min-w-0 items-center gap-3 text-xs">
                <span className="w-24 truncate">{name}</span>
                <progress aria-label={name} value={frame.progress[index]} max={100} className="h-2 min-w-0 flex-1 accent-accent" />
              </label>)}
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {race.phase === "finished" ? <h2 ref={resultRef} tabIndex={-1} className="font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
                {playable.place}<span className="ml-2 tabular-nums">{number.format(result.place)} / {number.format(4)}</span>
              </h2> : <p className="font-semibold">{race.phase === "racing" ? playable.racing : focused ? playable.promptFocused : playable.prompt}</p>}
              <p className="flex gap-4 tabular-nums text-muted">
                <span>{number.format(result.wpm)} {playable.wpm}</span>
                <span>{percent.format(result.accuracy / 100)} {playable.accuracy}</span>
              </p>
            </div>
            {race.phase === "finished" ? <div className="mt-4">
              <ol aria-label={playable.place} className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                {result.order.map((racer, index) => <li key={racer}><span className="mr-1 tabular-nums">{number.format(index + 1)}</span>{labels.racers[racer]}</li>)}
              </ol>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { reset(true); setUserPaused(false); requestAnimationFrame(() => inputRef.current?.focus()); }}>{playable.replay}</Button>
                <ButtonLink href={`/${locale}/race/settings`} prefetch={false} variant="secondary">{playable.challenge}</ButtonLink>
              </div>
            </div> : <>
              <label htmlFor="home-race-input" className="mt-3 block cursor-text">
                <span className="text-sm text-muted">{playable.inputLabel}</span>
                <span id="home-race-text" className="mt-1 block break-words whitespace-pre-wrap font-mono text-base leading-relaxed" aria-hidden="true">
                  {Array.from(race.text).map((char, index) => <span key={index} className={
                    index < race.typed.length
                      ? race.typed[index] === char ? "text-accent-text" : "bg-danger/15 text-danger underline"
                      : index === race.typed.length ? "text-foreground underline decoration-accent-text decoration-2 underline-offset-4" : "text-muted"
                  }>{char}</span>)}
                </span>
              </label>
              <input ref={inputRef} id="home-race-input" name="trial" type="text" value={draft ?? race.typed}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={(event) => { composing.current = false; setDraft(null); type(event.currentTarget.value); }}
                onBlur={() => { setFocused(false); composing.current = false; setDraft(null); }}
                onSelect={keepCaretAtEnd} onKeyUp={keepCaretAtEnd} onMouseUp={keepCaretAtEnd}
                aria-describedby="home-race-sentence home-race-hint" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="mt-2 min-h-11 w-full rounded-field border border-border bg-surface px-3 font-mono text-base text-foreground caret-accent-text focus-visible:outline-2 focus-visible:outline-accent-text"
              />
              <p id="home-race-sentence" className="sr-only">{race.text}</p>
              <p id="home-race-hint" className="mt-2 text-xs text-muted">{playable.hint}</p>
            </>}
          </>}
          <p role="status" className="sr-only">{race.phase === "finished" ? playable.result
            .replace("{wpm}", number.format(result.wpm))
            .replace("{accuracy}", percent.format(result.accuracy / 100))
            .replace("{place}", number.format(result.place)) : ""}</p>
        </div>
      </div>
      <figcaption className="mt-3 px-4 text-center text-xs text-muted">{labels.caption}</figcaption>
    </figure>
  );
}
