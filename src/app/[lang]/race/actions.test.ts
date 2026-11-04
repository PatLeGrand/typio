// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { EMPTY_CORPUS } from "@/race/textGenerator";
import { TEST_CORPUS } from "@/test/corpus";

const mocks = vi.hoisted(() => ({ load: vi.fn(), ip: "203.0.113.1" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": mocks.ip }) }));
vi.mock("@/race/drizzleTextCorpusRepository", () => ({ textCorpusRepository: { load: mocks.load } }));
import { nextRaceText } from "./actions";

let ipIndex = 0;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ip = `203.0.113.${++ipIndex}`;
  mocks.load.mockResolvedValue(TEST_CORPUS);
});

describe("nextRaceText", () => {
  it("valide les données non fiables avant de lire le corpus", async () => {
    expect(await nextRaceText({ settings: { ...DEFAULT_RACE_SETTINGS, language: "sql" } }))
      .toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
    expect(await nextRaceText({ settings: DEFAULT_RACE_SETTINGS, previous: "a".repeat(1001) }))
      .toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("renvoie un nouveau texte différent du précédent", async () => {
    const first = await nextRaceText({ settings: DEFAULT_RACE_SETTINGS });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await nextRaceText({ settings: DEFAULT_RACE_SETTINGS, previous: first.text });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.text).not.toBe(first.text);
  });
  it("utilise NO_TEXT_AVAILABLE quand le corpus est vide", async () => {
    mocks.load.mockResolvedValue(EMPTY_CORPUS);
    expect(await nextRaceText({ settings: DEFAULT_RACE_SETTINGS }))
      .toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
  });
  it("ne charge pas le corpus en mode mots", async () => {
    expect((await nextRaceText({ settings: { ...DEFAULT_RACE_SETTINGS, textMode: "words" } })).ok).toBe(true);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});

it("limite à 30 requêtes par minute avec une clé IPv6 partagée par /64", async () => {
  mocks.ip = "2001:db8:abcd:1234::1";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    expect((await nextRaceText({ settings: { ...DEFAULT_RACE_SETTINGS, textMode: "words" } })).ok).toBe(true);
  }
  mocks.ip = "2001:db8:abcd:1234::2";
  expect(await nextRaceText({ settings: DEFAULT_RACE_SETTINGS })).toEqual({ ok: false, error: "RATE_LIMITED" });
  expect(mocks.load).not.toHaveBeenCalled();
});
