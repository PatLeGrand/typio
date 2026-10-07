"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Keyboard, Pause, Play, Trophy, BarChart3, Delete, Sparkles, CircleCheck } from "lucide-react";
import { ButtonLink } from "@/components/ButtonLink";
import { Logo } from "@/components/Logo";
import { RaceVisualizer, type Racer } from "@/components/race/RaceVisualizer";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getEffectiveTimeLimitSeconds, type RaceSettings } from "@/race/config";
import { createRaceLifecycle, transitionRace, type RaceLifecycle } from "@/race/lifecycle";
import { buildRaceTexts } from "@/race/sentences";

const TICK_MS = 100;
const TRACK_LENGTH = 8000;
/** Avancée des bots en % de parcours par seconde, selon la difficulté. */
const BOT_RATE: Record<RaceSettings["botDifficulty"], number> = { easy: 1.2, normal: 2, hard: 3 };
const BOT_NAMES = ["Milo", "Nino", "Luna", "Poppy", "Zoé", "Max", "Lia"];
/** Teinte (degrés) par rapport au Blob bleu d'origine : toi = violet, puis rose, vert, orange… */
const LOCAL_HUE = 58;
const BOT_HUES = [-170, 0, -100, 135, 90, -60, 180];
/** Facteur propre à chaque bot : ils ne vont pas tous à la même vitesse. */
const BOT_PACE = [1.1, 0.9, 1, 0.75, 1.05, 0.85, 0.95];

type Props = {
  locale: Locale;
  labels: Dictionary["raceScreen"];
  siteName: string;
  backLabel: string;
  settings: RaceSettings;
  /** Nom affiché dans l'en-tête, ou `null` pour un visiteur. */
  userName: string | null;
};

/** Longueur du préfixe correctement tapé. */
function correctPrefixLength(typed: string, text: string): number {
  let index = 0;
  while (index < typed.length && index < text.length && typed[index] === text[index]) index += 1;
  return index;
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatRank(locale: Locale, rank: number, total: number, of: string): string {
  if (locale === "fr") return `${rank === 1 ? "1er" : `${rank}e`} ${of} ${total}`;
  const suffix = new Intl.PluralRules("en", { type: "ordinal" }).select(rank);
  const suffixes: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd", other: "th" };
  return `${rank}${suffixes[suffix] ?? "th"} ${of} ${total}`;
}

/** Écran de course : classement, scène animée (Pixi), statistiques et zone de frappe. */
export function RaceScreen({ locale, labels, siteName, backLabel, settings, userName }: Props) {
  const [texts] = useState(() => buildRaceTexts(settings));
  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);

  const [initialLifecycle] = useState<RaceLifecycle>(() => transitionRace(createRaceLifecycle(settings), { type: "start" }, 0));
  const lifecycleRef = useRef<RaceLifecycle>(initialLifecycle);
  const clockRef = useRef(0);
  const [lifecycle, setLifecycle] = useState<RaceLifecycle>(initialLifecycle);
  const [clock, setClock] = useState(0);
  const [paused, setPaused] = useState(false);

  const [botProgress, setBotProgress] = useState<number[]>(() => Array.from({ length: settings.botCount }, () => 0));
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [value, setValue] = useState("");
  const [completedChars, setCompletedChars] = useState(0);
  const [bestWpm, setBestWpm] = useState(0);
  const [keystrokes, setKeystrokes] = useState({ total: 0, correct: 0 });
  const correctCharsRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const phrase = texts[phraseIndex] ?? "";
  const typedCorrect = correctPrefixLength(value, phrase);
  const localProgress = totalChars === 0 ? 0 : Math.min(100, ((completedChars + typedCorrect) / totalChars) * 100);
  const correctChars = completedChars + typedCorrect;

  const phase = lifecycle.phase;
  const racing = phase === "racing" && !paused;

  // Horloge unique : fait avancer le cycle de vie et les bots, et se fige en pause.
  useEffect(() => {
    if (paused || phase === "results") return;
    const id = setInterval(() => {
      clockRef.current += TICK_MS;
      const now = clockRef.current;
      const next = transitionRace(lifecycleRef.current, { type: "tick" }, now);
      lifecycleRef.current = next;
      setLifecycle(next);
      setClock(now);
      if (next.phase !== "racing") return;
      const rate = BOT_RATE[settings.botDifficulty];
      setBotProgress((previous) =>
        previous.map((progress, index) => {
          const jitter = 0.7 + Math.random() * 0.6;
          return Math.min(100, progress + rate * BOT_PACE[index % BOT_PACE.length] * jitter * (TICK_MS / 1000));
        }),
      );
      const minutes = (now - next.startsAt) / 60_000;
      if (minutes > 0.05) setBestWpm((best) => Math.max(best, Math.round(correctCharsRef.current / 5 / minutes)));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, phase, settings.botDifficulty]);

  useEffect(() => {
    correctCharsRef.current = correctChars;
  }, [correctChars]);

  // Le champ de saisie prend le focus dès que la course démarre ou reprend.
  useEffect(() => {
    if (racing) inputRef.current?.focus();
  }, [racing]);

  // Échap met la course en pause / la reprend.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (lifecycleRef.current.phase === "racing")) setPaused((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onChange(next: string) {
    if (!racing) return;
    const blocking = settings.inputMode === "blocking";
    if (blocking && !phrase.startsWith(next)) {
      if (next.length > value.length) setKeystrokes((k) => ({ ...k, total: k.total + 1 }));
      return; // saisie bloquée : le mauvais caractère n'entre pas
    }
    if (next.length > value.length) {
      const hit = phrase.startsWith(next);
      setKeystrokes((k) => ({ total: k.total + 1, correct: k.correct + (hit ? 1 : 0) }));
    }
    if (next !== phrase) {
      setValue(next);
      return;
    }
    // Validation automatique : la phrase est exacte.
    const done = completedChars + phrase.length;
    setCompletedChars(done);
    setValue("");
    if (phraseIndex + 1 >= texts.length) {
      const finished = transitionRace(lifecycleRef.current, { type: "complete" }, clockRef.current);
      lifecycleRef.current = finished;
      setLifecycle(finished);
    } else {
      setPhraseIndex(phraseIndex + 1);
    }
  }

  const localRacer: Racer = { id: "local", name: labels.you, progress: localProgress, isLocal: true, hue: LOCAL_HUE };
  const racers: Racer[] = [
    localRacer,
    ...botProgress.map((progress, index) => ({
      id: `bot-${index}`,
      name: BOT_NAMES[index % BOT_NAMES.length],
      progress,
      hue: BOT_HUES[index % BOT_HUES.length],
    })),
  ];
  const ranking = [...racers].sort((a, b) => b.progress - a.progress);
  const rank = ranking.findIndex((racer) => racer.isLocal) + 1;

  const elapsedMs =
    phase === "racing" ? Math.max(0, clock - lifecycle.startsAt)
    : phase === "results" ? lifecycle.finishedAt - lifecycle.startsAt
    : 0;
  const accuracy = keystrokes.total === 0 ? 100 : Math.round((keystrokes.correct / keystrokes.total) * 100);
  const timeLeftMs = phase === "racing" ? lifecycle.endsAt - clock : getEffectiveTimeLimitSeconds(settings) * 1000;

  const view = phase === "results" ? "finished" : paused ? "paused" : phase === "countdown" ? "countdown" : "racing";
  const headline = view === "finished" ? labels.headline[lifecycle.phase === "results" && lifecycle.reason === "completed" ? "completed" : "timeout"] : labels.headline[view];
  const countdownLeft = phase === "countdown" ? Math.max(1, Math.ceil((lifecycle.startsAt - clock) / 1000)) : null;
  const playerCount = racers.length;
  const statusTone = view === "racing" ? "bg-island-mint text-foreground" : "bg-accent-soft text-accent-text";
  const charsInPhrase = Math.min(typedCorrect, phrase.length);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-4 sm:px-8 lg:px-10">
          <Link href={`/${locale}`} className="rounded-field">
            <Logo name={siteName} />
          </Link>
          <div className="order-3 flex w-full items-center justify-center gap-3 text-sm lg:order-none lg:w-auto">
            <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide ${statusTone}`} role="status">
              {labels.status[phase === "results" ? "finished" : view === "paused" ? "paused" : phase === "countdown" ? "countdown" : "racing"]}
            </span>
            <span className="font-extrabold">{labels.roomName}</span>
            <span className="text-muted">{playerCount} {playerCount > 1 ? labels.playerOther : labels.playerOne}</span>
          </div>
          <div className="flex items-center gap-2">
            {userName ? (
              <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold">{userName}</span>
            ) : null}
            <button
              type="button"
              disabled={phase !== "racing"}
              onClick={() => setPaused((value) => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-field border border-border bg-surface px-4 text-sm font-bold transition-colors not-disabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-muted"
            >
              {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
              {paused ? labels.resume : labels.pause}
              <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-bold text-muted">Esc</kbd>
            </button>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[560px] overflow-hidden">
        <RaceVisualizer
          racers={racers}
          trackLength={TRACK_LENGTH}
          showHud={false}
          className="absolute inset-0 -z-10"
        />
        {countdownLeft !== null ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-[9rem] font-black leading-none text-accent-text drop-shadow-[0_6px_0_var(--surface)] sm:text-[13rem]">
              {countdownLeft}
            </span>
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-24 pt-6 sm:px-8 lg:min-h-[560px] lg:flex-row lg:items-start lg:justify-between lg:px-10 lg:pt-6">
          <aside className="w-full rounded-card border-2 border-border bg-surface/95 p-5 shadow-soft lg:w-[280px] lg:shrink-0">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <Trophy aria-hidden="true" className="size-5 text-accent-text" />
              {labels.leaderboard}
            </h2>
            <ol className="mt-4 flex flex-col gap-1">
              {ranking.map((racer, index) => (
                <li
                  key={racer.id}
                  className={`flex items-center gap-3 rounded-field px-2.5 py-2 text-sm font-bold ${racer.isLocal ? "bg-accent-panel text-accent-text" : ""}`}
                >
                  <span className="w-3 text-xs text-muted">{index + 1}</span>
                  <span className="flex-1">{racer.name}</span>
                  <span>{Math.round(racer.progress)}%</span>
                </li>
              ))}
            </ol>
          </aside>

          <div className="order-first flex flex-col items-center gap-3 pt-2 text-center lg:order-none lg:pt-8">
            <p className="text-xs font-extrabold tracking-wide text-accent-text">{labels.kicker[view]}</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{headline}</h1>
            <p className="rounded-full bg-surface/95 px-4 py-2 text-sm shadow-soft">
              <strong className="text-accent-text">{formatRank(locale, rank, playerCount, labels.rankOf)}</strong>
              <span className="mx-2 text-muted" aria-hidden="true">•</span>
              {Math.round(localProgress)} {labels.trackProgress}
            </p>
          </div>

          <aside className="w-full rounded-card border-2 border-border bg-surface/95 p-5 shadow-soft lg:w-[280px] lg:shrink-0">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <BarChart3 aria-hidden="true" className="size-5 text-accent-text" />
              {labels.stats.title}
            </h2>
            <dl className="mt-4 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted">{labels.stats.time}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatClock(phase === "racing" || phase === "results" ? elapsedMs : 0)}</dd>
              <dt className="text-muted">{labels.stats.bestWpm}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{bestWpm}</dd>
              <dt className="text-muted">{labels.stats.accuracy}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{accuracy}%</dd>
            </dl>
            <p className="sr-only">{formatClock(Math.max(0, timeLeftMs))}</p>
          </aside>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Keyboard aria-hidden="true" className="size-5 text-accent-text" />
            <h2 className="text-lg font-extrabold">{labels.typing.title}</h2>
            <span className="text-sm text-muted">{labels.typing.phrase} {Math.min(phraseIndex + 1, texts.length)} / {texts.length}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-muted">
            <span>{charsInPhrase} / {phrase.length} {labels.typing.characters}</span>
            <span className="h-2 w-28 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${phrase.length === 0 ? 0 : (charsInPhrase / phrase.length) * 100}%` }} />
            </span>
          </div>
        </div>

        <p className="rounded-card border border-border bg-surface px-6 py-5 font-mono text-xl leading-relaxed sm:text-2xl" aria-hidden="true">
          {Array.from(phrase).map((char, index) => {
            const typed = value[index];
            const tone =
              typed === undefined ? (index === value.length ? "text-foreground underline decoration-accent-text decoration-2 underline-offset-4" : "text-muted")
              : typed === char ? "text-success"
              : "bg-danger/15 text-danger";
            return <span key={index} className={tone}>{char}</span>;
          })}
        </p>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onPaste={(event) => event.preventDefault()}
            disabled={!racing}
            aria-label={labels.typing.inputLabel}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-14 w-full rounded-card border-2 border-accent bg-surface px-5 pr-12 font-mono text-lg outline-none focus-visible:outline-2 disabled:border-border disabled:text-muted"
          />
          <CircleCheck aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-accent-text" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <p className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-accent-text" />
            {labels.typing.hint}
          </p>
          <p className="flex items-center gap-2">
            <kbd className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5"><Delete aria-hidden="true" className="size-3.5" /></kbd>
            {labels.typing.fix}
            <span aria-hidden="true">·</span>
            {labels.typing.autoValidate}
          </p>
        </div>

        <div>
          <ButtonLink href={`/${locale}/race/settings`} variant="secondary">{backLabel}</ButtonLink>
        </div>
      </section>
    </div>
  );
}
