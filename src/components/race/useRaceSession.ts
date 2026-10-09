"use client";

import { useCallback, useEffect, useState } from "react";
import type { RaceSettings } from "@/race/config";
import { createRaceText } from "@/race/raceText";
import { createRound, type Round } from "@/race/round";
import { abandonRaceSession, tickRaceSession, typeIntoRaceSession, type RaceSession } from "@/race/session";

/** Fréquence de rafraîchissement de l'affichage ; le temps, lui, vient toujours de `now()` (A-D6). */
const TICK_MS = 100;

export const defaultNow = (): number => performance.now();

interface RoundState {
  /** `null` : aucun texte disponible avec ces réglages (TEXTE-1, A-D5). */
  round: Round | null;
  /** Dernier instant lu sur l'horloge, pour l'affichage. */
  clock: number;
  count: number;
}

export interface UseRaceSession {
  round: Round | null;
  clock: number;
  typeInput: (next: string) => void;
  abandon: () => void;
  /** Nouvelle manche, mêmes réglages, nouveau texte (A-D7). */
  replay: () => void;
}

interface Options {
  settings: RaceSettings;
  initialText: string | null;
  botNames: readonly string[];
  now: () => number;
  random: () => number;
}

/** Porte l'état d'une manche et l'horloge qui la fait vivre ; la logique est dans `src/race`. */
export function useRaceSession({ settings, initialText, botNames, now, random }: Options): UseRaceSession {
  const [state, setState] = useState<RoundState>(() => {
    const t = now();
    return {
      round: initialText === null ? null : createRound(1, settings, initialText, botNames, t, random),
      clock: t,
      count: 1,
    };
  });

  const phase = state.round?.session.lifecycle.phase;
  useEffect(() => {
    if (!phase || phase === "results") return;
    const id = setInterval(() => {
      const t = now();
      setState((previous) => updateSession(previous, t, (session) => tickRaceSession(session, t)));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, now]);

  const typeInput = useCallback(
    (next: string) => {
      const t = now();
      setState((previous) => updateSession(previous, t, (session) => typeIntoRaceSession(session, next, t)));
    },
    [now],
  );

  const abandon = useCallback(() => {
    const t = now();
    setState((previous) => updateSession(previous, t, (session) => abandonRaceSession(session, t)));
  }, [now]);

  const previousText = state.round?.session.text;
  const nextCount = state.count + 1;
  const replay = useCallback(() => {
    const t = now();
    const text = createRaceText(settings, random, previousText);
    const round = text === null ? null : createRound(nextCount, settings, text, botNames, t, random);
    setState({ round, clock: t, count: nextCount });
  }, [now, random, settings, botNames, previousText, nextCount]);

  return { round: state.round, clock: state.clock, typeInput, abandon, replay };
}

function updateSession(state: RoundState, clock: number, change: (session: RaceSession) => RaceSession): RoundState {
  if (!state.round) return state;
  const session = change(state.round.session);
  return { ...state, clock, round: session === state.round.session ? state.round : { ...state.round, session } };
}
