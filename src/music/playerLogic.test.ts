import { expect, it } from "vitest";
import { autoCollapseDelay, isFirstVisit, nextTrackIndex, playbackVolume, readMusicPreferences } from "./playerLogic";

it("boucle la liste, atténue le volume et récupère les préférences valides", () => {
  expect(nextTrackIndex(1, 1, 3)).toBe(2);
  expect(nextTrackIndex(2, 1, 3)).toBe(0);
  expect(nextTrackIndex(0, -1, 3)).toBe(2);
  expect(nextTrackIndex(0, 1, 1)).toBe(0);
  expect(nextTrackIndex(0, 1, 0)).toBe(0);
  expect(playbackVolume(0.8, true)).toBeCloseTo(0.24);
  expect(playbackVolume(0.8, false)).toBe(0.8);
  expect(playbackVolume(0, true)).toBe(0);

  const defaults = { volume: 0.5, muted: false, collapsed: true, paused: false };
  expect(readMusicPreferences(() => null)).toEqual(defaults);
  expect(readMusicPreferences(() => "{")).toEqual(defaults);
  expect(readMusicPreferences(() => "null")).toEqual(defaults);
  expect(readMusicPreferences(() => { throw new Error("stockage bloqué"); })).toEqual(defaults);
  expect(readMusicPreferences(() => '{"volume":2,"muted":"true","collapsed":false,"paused":"yes"}'))
    .toEqual({ ...defaults, collapsed: false });
  expect(readMusicPreferences(() => '{"volume":0,"muted":true,"collapsed":false}'))
    .toEqual({ volume: 0, muted: true, collapsed: false, paused: false });
  expect(readMusicPreferences(() => '{"volume":0,"muted":true,"collapsed":false,"paused":true}'))
    .toEqual({ volume: 0, muted: true, collapsed: false, paused: true });
});

it("n'accueille qu'à la première visite, jamais si le stockage est bloqué", () => {
  expect(isFirstVisit(() => null)).toBe(true);
  expect(isFirstVisit(() => "{}")).toBe(false);
  expect(isFirstVisit(() => { throw new Error("stockage bloqué"); })).toBe(false);
});

it("replie seul : 4 s pour l'aperçu, 3 s après ouverture, jamais sous le pointeur ou le focus", () => {
  expect(autoCollapseDelay({ open: true, welcoming: true, holding: false })).toBe(4000);
  expect(autoCollapseDelay({ open: true, welcoming: false, holding: false })).toBe(3000);
  expect(autoCollapseDelay({ open: true, welcoming: false, holding: true })).toBeNull();
  expect(autoCollapseDelay({ open: false, welcoming: false, holding: false })).toBeNull();
});
