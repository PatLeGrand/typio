import { getEffectiveTimeLimitSeconds, type RaceSettings } from "./config";
import { createRaceLifecycle, transitionRace, type RaceLifecycle, type RaceLifecycleEvent } from "./lifecycle";
import { applyTypedInput, countCorrectChars, NO_KEYSTROKES, type Keystrokes } from "./metrics";
import type { PlayerOutcome } from "./results";

/**
 * Course locale d'un joueur (A-D6) : cycle de vie + saisie + frappes. Module pur : l'instant
 * `now` est toujours fourni par l'appelant (horodatage, jamais un cumul de ticks).
 */
export interface RaceSession {
  text: string;
  inputMode: RaceSettings["inputMode"];
  lifecycle: RaceLifecycle;
  typed: string;
  keystrokes: Keystrokes;
}

/** Crée la session et lance aussitôt le compte à rebours. */
export function createRaceSession(settings: RaceSettings, text: string, now: number): RaceSession {
  const lifecycle = transitionRace(createRaceLifecycle(settings), { type: "start" }, now);
  return { text, inputMode: settings.inputMode, lifecycle, typed: "", keystrokes: NO_KEYSTROKES };
}

function withLifecycle(session: RaceSession, event: RaceLifecycleEvent, now: number): RaceSession {
  const lifecycle = transitionRace(session.lifecycle, event, now);
  return lifecycle === session.lifecycle ? session : { ...session, lifecycle };
}

/** Fait avancer le compte à rebours et la limite de temps ; rend la même session si rien ne change. */
export function tickRaceSession(session: RaceSession, now: number): RaceSession {
  return withLifecycle(session, { type: "tick" }, now);
}

/** Saisie du joueur. Ignorée hors course, et après la limite de temps (la limite prime). */
export function typeIntoRaceSession(session: RaceSession, next: string, now: number): RaceSession {
  const current = tickRaceSession(session, now);
  if (current.lifecycle.phase !== "racing") return current;

  const { typed, keystrokes } = applyTypedInput(current.typed, next, current.text, current.inputMode, current.keystrokes);
  const updated = { ...current, typed, keystrokes };
  return typed === current.text ? withLifecycle(updated, { type: "complete" }, now) : updated;
}

/** COURSE-5 : abandon volontaire, possible seulement en course. */
export function abandonRaceSession(session: RaceSession, now: number): RaceSession {
  return withLifecycle(tickRaceSession(session, now), { type: "abandon" }, now);
}

/** Durée écoulée depuis le départ, bornée par la limite de temps (0 avant le départ). */
export function raceElapsedMs(session: RaceSession, now: number): number {
  const { lifecycle } = session;
  if (lifecycle.phase === "results") return lifecycle.finishedAt - lifecycle.startsAt;
  if (lifecycle.phase !== "racing") return 0;
  return Math.min(Math.max(0, now - lifecycle.startsAt), lifecycle.endsAt - lifecycle.startsAt);
}

/** Temps restant avant la limite (limite entière avant le départ, 0 à la fin). */
export function raceTimeLeftMs(session: RaceSession, now: number): number {
  const { lifecycle } = session;
  if (lifecycle.phase === "results") {
    return Math.max(0, lifecycle.startsAt + getEffectiveTimeLimitSeconds(lifecycle.settings) * 1000 - lifecycle.finishedAt);
  }
  if (lifecycle.phase !== "racing") return getEffectiveTimeLimitSeconds(lifecycle.settings) * 1000;
  return Math.max(0, lifecycle.endsAt - now);
}

/** Résultat du joueur, une fois la course terminée. */
export function getPlayerOutcome(session: RaceSession): PlayerOutcome | null {
  const { lifecycle } = session;
  if (lifecycle.phase !== "results") return null;
  return {
    reason: lifecycle.reason,
    elapsedMs: lifecycle.finishedAt - lifecycle.startsAt,
    correctChars: lifecycle.reason === "completed" ? session.text.length : countCorrectChars(session.typed, session.text),
    keystrokes: session.keystrokes,
  };
}
