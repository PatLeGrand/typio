"use client";

import Link from "next/link";
import { BarChart3, Flag, Trophy } from "lucide-react";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { RaceNoText } from "@/components/race/RaceNoText";
import { RaceResults } from "@/components/race/RaceResults";
import { RaceTypingPanel } from "@/components/race/RaceTypingPanel";
import { RaceVisualizer, type Racer } from "@/components/race/RaceVisualizer";
import { defaultNow, useRaceSession } from "@/components/race/useRaceSession";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { serializeRaceSettings, type RaceSettings } from "@/race/config";
import { formatClock, formatOrdinal } from "@/race/format";
import { countCorrectChars } from "@/race/metrics";
import { PLAYER_ID, snapshotRound } from "@/race/round";

const TRACK_LENGTH = 8000;
/** Teinte (degrés) par rapport au Blob bleu d'origine : toi = violet, puis rose, vert, orange… */
const LOCAL_HUE = 58;
const BOT_HUES = [-170, 0, -100, 135, 90, -60, 180];
/** Le lecteur d'écran est prévenu de l'avancement par paliers, pas à chaque frappe. */
const ANNOUNCE_STEP = 25;

type Props = {
  locale: Locale;
  labels: Dictionary["raceScreen"];
  siteName: string;
  settings: RaceSettings;
  /** Nom affiché dans l'en-tête, ou `null` pour un visiteur. */
  userName: string | null;
  /** Texte tiré côté serveur (hydratation identique), ou `null` si les filtres n'en laissent aucun. */
  initialText: string | null;
  /** Horloge en ms ; injectable pour les tests (A-D6). */
  now?: () => number;
  /** Tirage dans [0, 1[ ; injectable pour les tests (TEXTE-2, BOT-2). */
  random?: () => number;
};

/** Écran de course solo : classement, scène animée (Pixi), statistiques, zone de frappe puis résultats. */
export function RaceScreen({
  locale,
  labels,
  siteName,
  settings,
  userName,
  initialText,
  now = defaultNow,
  random = Math.random,
}: Props) {
  const { round, clock, typeInput, abandon, replay } = useRaceSession({
    settings,
    initialText,
    botNames: labels.botNames,
    now,
    random,
  });
  const settingsHref = `/${locale}/race/settings?${serializeRaceSettings(settings)}`;

  if (!round) return <RaceNoText labels={labels.noText} settingsHref={settingsHref} />;

  const snapshot = snapshotRound(round, clock, labels.you);
  const { phase, racers, results } = snapshot;
  const player = racers.find((racer) => racer.isPlayer);
  const playerProgress = player?.progress ?? 0;
  const racing = phase === "racing";
  const view = phase === "results" ? "finished" : phase;
  const headline = snapshot.endReason ? labels.headline[snapshot.endReason] : labels.headline[racing ? "racing" : "countdown"];
  const playerCount = racers.length;
  const statusTone = racing ? "bg-island-mint text-foreground" : "bg-accent-soft text-accent-text";
  const correctChars = countCorrectChars(round.session.typed, round.session.text);

  // Les couloirs de la scène restent fixes : seul le classement change l'ordre de la liste.
  const lane: Racer[] = [PLAYER_ID, ...round.bots.map((bot) => bot.id)].map((id, index) => {
    const racer = racers.find((candidate) => candidate.id === id);
    return {
      id,
      name: racer?.name ?? id,
      progress: racer?.progress ?? 0,
      isLocal: id === PLAYER_ID,
      hue: index === 0 ? LOCAL_HUE : BOT_HUES[(index - 1) % BOT_HUES.length],
    };
  });
  const announcedStep = Math.floor(playerProgress / ANNOUNCE_STEP) * ANNOUNCE_STEP;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-4 sm:px-8 lg:px-10">
          <Link href={`/${locale}`} className="rounded-field">
            <Logo name={siteName} />
          </Link>
          <div className="order-3 flex w-full items-center justify-center gap-3 text-sm lg:order-none lg:w-auto">
            <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide ${statusTone}`} role="status">
              {labels.status[view]}
            </span>
            <span className="font-extrabold">{labels.roomName}</span>
            <span className="text-muted">{playerCount} {playerCount > 1 ? labels.playerOther : labels.playerOne}</span>
          </div>
          <div className="flex items-center gap-2">
            {userName ? (
              <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold">{userName}</span>
            ) : null}
            <Button variant="secondary" disabled={!racing} onClick={abandon} className="min-h-11 py-2">
              <Flag aria-hidden="true" className="size-4" />
              {labels.abandon}
            </Button>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[560px] overflow-hidden">
        <RaceVisualizer
          key={round.id}
          racers={lane}
          trackLength={TRACK_LENGTH}
          className="absolute inset-0 -z-10"
        />
        {snapshot.countdownSeconds > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span data-testid="countdown" className="text-[9rem] font-black leading-none text-accent-text drop-shadow-[0_6px_0_var(--surface)] sm:text-[13rem]">
              {snapshot.countdownSeconds}
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
              {racers.map((racer, index) => (
                <li
                  key={racer.id}
                  className={`flex items-center gap-3 rounded-field px-2.5 py-2 text-sm font-bold ${racer.isPlayer ? "bg-accent-panel text-accent-text" : ""}`}
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
              <strong className="text-accent-text">
                {formatOrdinal(locale, snapshot.playerRank, labels.ordinal)} {labels.rankOf} {playerCount}
              </strong>
              <span className="mx-2 text-muted" aria-hidden="true">•</span>
              {Math.round(playerProgress)} {labels.trackProgress}
            </p>
          </div>

          <aside className="w-full rounded-card border-2 border-border bg-surface/95 p-5 shadow-soft lg:w-[280px] lg:shrink-0">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <BarChart3 aria-hidden="true" className="size-5 text-accent-text" />
              {labels.stats.title}
            </h2>
            <dl className="mt-4 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted">{labels.stats.timeLeft}</dt>
              <dd className="text-2xl font-extrabold tabular-nums" role="timer">{formatClock(snapshot.timeLeftMs, "ceil")}</dd>
              <dt className="text-muted">{labels.stats.time}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{formatClock(snapshot.elapsedMs)}</dd>
              <dt className="text-muted">{labels.stats.wpm}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{snapshot.wpm}</dd>
              <dt className="text-muted">{labels.stats.accuracy}</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{snapshot.accuracy}%</dd>
            </dl>
          </aside>
        </div>
      </section>

      {racing ? (
        <p className="sr-only" aria-live="polite">{announcedStep} {labels.trackProgress}</p>
      ) : null}

      {results ? (
        <RaceResults
          locale={locale}
          labels={labels}
          rows={results}
          headline={headline}
          settingsHref={settingsHref}
          onReplay={replay}
        />
      ) : (
        <RaceTypingPanel
          labels={labels.typing}
          text={round.session.text}
          typed={round.session.typed}
          disabled={!racing}
          correctChars={correctChars}
          onChange={typeInput}
        />
      )}
    </div>
  );
}
