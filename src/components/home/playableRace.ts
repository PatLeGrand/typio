import { botFinishMs, botProgressAt, planBot, type BotPlan } from "@/race/bots";
import { applyTypedInput, computeAccuracy, computeWpm, countCorrectChars, NO_KEYSTROKES, type Keystrokes } from "@/race/metrics";
import { createSeededRandom } from "@/race/seededRandom";

export interface PlayableRace {
  phase: "waiting" | "racing" | "finished";
  text: string;
  typed: string;
  keystrokes: Keystrokes;
  elapsedMs: number;
  bots: BotPlan[];
}

export function createPlayableRace(text: string): PlayableRace {
  const bots = [30, 42, 58].map((wpm, index) => {
    const plan = planBot(text, index === 0 ? "beginner" : "intermediate", "free", createSeededRandom(text.length + index));
    const scale = text.length ? (text.length / (wpm * 5) * 60_000) / botFinishMs(plan) : 1;
    return {
      ...plan,
      keyframes: plan.keyframes.map((frame) => ({ ...frame, timeMs: frame.timeMs * scale })),
      mistakeTimesMs: plan.mistakeTimesMs.map((time) => time * scale),
      extraCorrectTimesMs: plan.extraCorrectTimesMs.map((time) => time * scale),
    };
  });
  return { phase: "waiting", text, typed: "", keystrokes: NO_KEYSTROKES, elapsedMs: 0, bots };
}

type Event = { type: "tick"; deltaMs: number } | { type: "input"; value: string; deltaMs: number } | { type: "reset" };

/** L'horloge ne fournit que le temps actif : les pauses ne changent ni MPM ni place. */
export function transitionPlayableRace(state: PlayableRace, event: Event): PlayableRace {
  if (event.type === "reset") return createPlayableRace(state.text);
  const delta = Math.max(0, event.deltaMs);
  const current = state.phase !== "racing" ? state : {
    ...state,
    elapsedMs: state.elapsedMs + delta,
  };
  if (event.type === "tick" || current.phase === "finished" || (!event.value && current.phase === "waiting")) return current;
  const { typed, keystrokes } = applyTypedInput(current.typed, event.value, current.text, "free", current.keystrokes);
  return { ...current, typed, keystrokes, phase: typed === current.text ? "finished" : "racing" };
}

export function playableRaceProgress(state: PlayableRace): number[] {
  return [countCorrectChars(state.typed, state.text), ...state.bots.map((bot) => botProgressAt(bot, state.elapsedMs))]
    .map((chars) => state.text.length ? chars / state.text.length * 100 : 0);
}

export function playableRaceResult(state: PlayableRace) {
  const order = [{ index: 0, finishMs: state.elapsedMs }, ...state.bots.map((bot, index) => ({ index: index + 1, finishMs: botFinishMs(bot) }))]
    .sort((a, b) => a.finishMs - b.finishMs || a.index - b.index)
    .map(({ index }) => index);
  return {
    wpm: computeWpm(countCorrectChars(state.typed, state.text), state.elapsedMs),
    accuracy: computeAccuracy(state.keystrokes),
    place: order.indexOf(0) + 1,
    order,
  };
}
