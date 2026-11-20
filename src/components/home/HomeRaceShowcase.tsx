"use client";

import { MediaPlaybackButton } from "./MediaPlaybackButton";
import { HomeLiveScene } from "./HomeLiveScene";
import { RaceInputCard } from "@/components/race/RaceInputCard";
import { HomeTrialInput } from "./HomeTrialInput";
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type SyntheticEvent } from "react";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";
import { getReducedMotionSnapshot, subscribeToReducedMotion } from "@/theme/reducedMotion";
import { createPlayableRace, playableRaceProgress, playableRaceResult, transitionPlayableRace } from "./playableRace";

const SPEEDS = [1.14, 1.2, 1.16, 1.17];
/** La démo s'ouvre en pleine course : c'est aussi l'image fixe du mobile et du mouvement réduit (PERF-01). */
const DEMO_START = [58, 44, 71, 33];
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
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, serverMotionSnapshot);
  const physicalKeyboard = usePhysicalKeyboard();
  const hydrated = useSyncExternalStore(subscribeHydration, hydrationSnapshot, serverHydrationSnapshot);
  const still = reducedMotion || !physicalKeyboard;
  const [activity, setActivity] = useState({ inView: false, hidden: true });
  const [userPaused, setUserPaused] = useState(false);
  const paused = userPaused || !activity.inView || activity.hidden;
  const [frame, setFrame] = useState({ progress: DEMO_START, pauseTicks: 0, tick: 0 });
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
    if (next.phase === "finished") {
      setFrame({ progress: playableRaceProgress(next), pauseTicks: 0, tick: 0 });
    } else if (previous.phase === "waiting" && next.phase !== "waiting") {
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
    if (still || paused || race.phase !== "waiting") return;
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
  }, [still, paused, race.phase]);

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
      <HomeLiveScene
        labels={labels}
        progress={frame.progress}
        still={still}
        paused={paused}
        moving={!still && !paused && race.phase !== "finished"}
        locale={locale}
        pauseControl={still ? null : <MediaPlaybackButton playing={!userPaused} label={userPaused ? labels.resume : labels.pause}
          onClick={() => {
            if (!userPaused) {
              const next = transitionPlayableRace(raceRef.current, { type: "tick", deltaMs: elapsed() });
              raceRef.current = next;
              setRace(next);
            }
            setUserPaused((value) => !value);
          }} />}
      />
      <div className="relative z-10 mx-auto mt-6 max-w-[960px] px-4 sm:px-8">
        <RaceInputCard data-home-typing>
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
                <Button variant="start" onClick={() => { reset(true); setUserPaused(false); requestAnimationFrame(() => inputRef.current?.focus()); }}>{playable.replay}</Button>
                <ButtonLink href={`/${locale}/race/settings`} prefetch={false} variant="secondary">{playable.challenge}</ButtonLink>
              </div>
            </div> : <>
              <HomeTrialInput
                text={race.text}
                typed={race.typed}
                inputLabel={playable.inputLabel}
                hint={playable.hint}
                inputProps={{
                  ref: inputRef,
                  value: draft ?? race.typed,
                  onChange: handleChange,
                  onFocus: () => setFocused(true),
                  onCompositionStart: () => { composing.current = true; },
                  onCompositionEnd: (event) => { composing.current = false; setDraft(null); type(event.currentTarget.value); },
                  onBlur: () => { setFocused(false); composing.current = false; setDraft(null); },
                  onSelect: keepCaretAtEnd,
                  onKeyUp: keepCaretAtEnd,
                  onMouseUp: keepCaretAtEnd,
                }}
              />
            </>}
          </>}
          <p role="status" className="sr-only">{race.phase === "finished" ? playable.result
            .replace("{wpm}", number.format(result.wpm))
            .replace("{accuracy}", percent.format(result.accuracy / 100))
            .replace("{place}", number.format(result.place)) : ""}</p>
        </RaceInputCard>
      </div>
      <figcaption className="mt-3 px-4 text-center text-xs text-muted">{labels.caption}</figcaption>
    </figure>
  );
}
