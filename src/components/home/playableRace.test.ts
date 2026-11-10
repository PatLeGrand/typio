import { describe, expect, it } from "vitest";
import { botFinishMs } from "@/race/bots";
import { getDictionary } from "@/i18n/dictionaries";
import { createPlayableRace, playableRaceProgress, playableRaceResult, transitionPlayableRace } from "./playableRace";

const text = "abcdefghij";
const start = () => transitionPlayableRace(createPlayableRace(text), { type: "input", value: "a", deltaMs: 5000 });

describe("playable race", () => {
  it("starts on the first input and measures correct characters, including spaces", () => {
    const waiting = createPlayableRace("ab cd");
    expect(transitionPlayableRace(waiting, { type: "tick", deltaMs: 60_000 })).toBe(waiting);
    expect(transitionPlayableRace(waiting, { type: "input", value: "", deltaMs: 1000 })).toBe(waiting);
    const racing = transitionPlayableRace(waiting, { type: "input", value: "ax ", deltaMs: 5000 });
    expect(racing.phase).toBe("racing");
    expect(racing.elapsedMs).toBe(0);
    expect(playableRaceProgress(racing)[0]).toBe(40);
    expect(playableRaceResult(racing).accuracy).toBe(67);
  });

  it("requires the whole correct sentence and keeps corrected errors in accuracy", () => {
    let state = transitionPlayableRace(start(), { type: "input", value: "abcxefghij", deltaMs: 1000 });
    expect(state.phase).toBe("racing");
    expect(playableRaceProgress(state)[0]).toBe(90);
    state = transitionPlayableRace(state, { type: "input", value: "abc", deltaMs: 1000 });
    state = transitionPlayableRace(state, { type: "input", value: text, deltaMs: 1000 });
    expect(state.phase).toBe("finished");
    expect(playableRaceProgress(state)[0]).toBe(100);
    expect(playableRaceResult(state)).toEqual({ wpm: 40, accuracy: 94, place: 3, order: [3, 2, 0, 1] });
    expect(transitionPlayableRace(state, { type: "input", value: "", deltaMs: 1000 }).typed).toBe(text);
    expect(playableRaceResult(transitionPlayableRace(state, { type: "tick", deltaMs: 5000 }))).toEqual(playableRaceResult(state));
  });

  it.each([[1000, 1], [2200, 2], [3200, 3], [4100, 4]])("ranks a finish after %i ms in place %i", (deltaMs, place) => {
    const state = transitionPlayableRace(start(), { type: "input", value: text, deltaMs });
    expect(playableRaceResult(state).place).toBe(place);
    expect(playableRaceProgress(state).every((progress) => progress >= 0 && progress <= 100)).toBe(true);
  });

  it("plans reproducible bots at 30, 42 and 58 WPM", () => {
    const state = createPlayableRace(text);
    expect(state.bots).toEqual(createPlayableRace(text).bots);
    state.bots.forEach((bot, index) => {
      expect(Math.round(text.length / 5 / (botFinishMs(bot) / 60_000))).toBe([30, 42, 58][index]);
    });
  });

  it("resets on Escape or 15 seconds without input, including after the finish", () => {
    const state = start();
    expect(transitionPlayableRace(state, { type: "reset" })).toEqual(createPlayableRace(text));
    const nearlyIdle = transitionPlayableRace(state, { type: "tick", deltaMs: 14_999 });
    expect(nearlyIdle.phase).toBe("racing");
    expect(transitionPlayableRace(nearlyIdle, { type: "tick", deltaMs: 1 }).phase).toBe("waiting");
    const active = transitionPlayableRace(nearlyIdle, { type: "input", value: "ab", deltaMs: 0 });
    expect(transitionPlayableRace(active, { type: "tick", deltaMs: 14_999 }).phase).toBe("racing");
    const finished = transitionPlayableRace(start(), { type: "input", value: text, deltaMs: 2000 });
    expect(transitionPlayableRace(finished, { type: "tick", deltaMs: 15_000 })).toEqual(createPlayableRace(text));
  });

  it.each(["fr", "en"] as const)("offers three short sentences in %s", (locale) => {
    const texts = getDictionary(locale).home.playableRace.texts;
    expect(new Set(texts).size).toBe(3);
    for (const sentence of texts) expect(sentence.length).toBeGreaterThanOrEqual(70);
    for (const sentence of texts) expect(sentence.length).toBeLessThanOrEqual(90);
  });
});
