import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_KEY_SOUND_SET,
  KEY_SOUND_SETS,
  KEY_SOUND_STORAGE_KEY,
  type KeySoundSet,
  isKeySoundSet,
  playKeySound,
  playKeySoundPreview,
  readKeySoundSet,
  resetAudioContextForTests,
  writeKeySoundSet,
} from "./keySounds";

type RecordedOscillator = {
  type: OscillatorType;
  startFreqs: Array<{ value: number; time: number }>;
  rampFreqs: Array<{ value: number; time: number }>;
  startedAt: number | null;
  stoppedAt: number | null;
};

type RecordedGain = {
  setValues: Array<{ value: number; time: number }>;
  linearRamps: Array<{ value: number; time: number }>;
  expRamps: Array<{ value: number; time: number }>;
};

function installMockAudioContext(state: AudioContextState = "running") {
  const oscillators: RecordedOscillator[] = [];
  const gains: RecordedGain[] = [];
  const resumeMock = vi.fn(() => Promise.resolve());

  class FakeAudioContext {
    currentTime = 1.0;
    state: AudioContextState = state;
    destination = {};
    resume = resumeMock;

    createOscillator() {
      const record: RecordedOscillator = {
        type: "sine",
        startFreqs: [],
        rampFreqs: [],
        startedAt: null,
        stoppedAt: null,
      };
      oscillators.push(record);

      return {
        get type() {
          return record.type;
        },
        set type(val: OscillatorType) {
          record.type = val;
        },
        frequency: {
          setValueAtTime: (value: number, time: number) => {
            record.startFreqs.push({ value, time });
          },
          exponentialRampToValueAtTime: (value: number, time: number) => {
            record.rampFreqs.push({ value, time });
          },
        },
        connect: vi.fn(),
        start: (time = 0) => {
          record.startedAt = time;
        },
        stop: (time = 0) => {
          record.stoppedAt = time;
        },
      };
    }

    createGain() {
      const record: RecordedGain = {
        setValues: [],
        linearRamps: [],
        expRamps: [],
      };
      gains.push(record);

      return {
        gain: {
          setValueAtTime: (value: number, time: number) => {
            record.setValues.push({ value, time });
          },
          linearRampToValueAtTime: (value: number, time: number) => {
            record.linearRamps.push({ value, time });
          },
          exponentialRampToValueAtTime: (value: number, time: number) => {
            record.expRamps.push({ value, time });
          },
        },
        connect: vi.fn(),
      };
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  if (typeof window !== "undefined") {
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  }

  return { oscillators, gains, resumeMock };
}

describe("keySounds validation & persistence", () => {
  beforeEach(() => {
    resetAudioContextForTests();
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioContextForTests();
  });

  it("valide uniquement les sets de sons connus via isKeySoundSet", () => {
    for (const set of KEY_SOUND_SETS) {
      expect(isKeySoundSet(set)).toBe(true);
    }
    expect(isKeySoundSet("arcade")).toBe(false);
    expect(isKeySoundSet("")).toBe(false);
    expect(isKeySoundSet(null)).toBe(false);
    expect(isKeySoundSet(undefined)).toBe(false);
    expect(isKeySoundSet(42)).toBe(false);
    expect(isKeySoundSet({})).toBe(false);
  });

  it("lit la valeur par défaut, la valeur sauvegardée, une valeur corrompue ou gère une exception localStorage", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };

    expect(readKeySoundSet(storage)).toBe(DEFAULT_KEY_SOUND_SET);

    storage.setItem(KEY_SOUND_STORAGE_KEY, "typewriter");
    expect(readKeySoundSet(storage)).toBe("typewriter");

    storage.setItem(KEY_SOUND_STORAGE_KEY, "corrupted-value");
    expect(readKeySoundSet(storage)).toBe(DEFAULT_KEY_SOUND_SET);

    const throwingStorage = {
      getItem: () => {
        throw new Error("Storage blocked");
      },
    };
    expect(readKeySoundSet(throwingStorage)).toBe(DEFAULT_KEY_SOUND_SET);
    expect(readKeySoundSet(null)).toBe(DEFAULT_KEY_SOUND_SET);
  });

  it("écrit le set dans localStorage et émet l'événement typio:key-sound-change", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };

    const events: KeySoundSet[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<KeySoundSet>).detail);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("typio:key-sound-change", listener);
    }

    writeKeySoundSet("retro", storage);
    expect(memory.get(KEY_SOUND_STORAGE_KEY)).toBe("retro");
    expect(readKeySoundSet(storage)).toBe("retro");

    if (typeof window !== "undefined") {
      expect(events).toEqual(["retro"]);
      window.removeEventListener("typio:key-sound-change", listener);
    }

    const throwingStorage = {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeKeySoundSet("soft", throwingStorage)).not.toThrow();
  });
});

describe("playKeySound & playKeySoundPreview", () => {
  beforeEach(() => {
    resetAudioContextForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioContextForTests();
  });

  it("ne joue aucun son lorsque le set est 'none'", () => {
    const { oscillators } = installMockAudioContext();
    playKeySound("hit", "none");
    playKeySound("miss", "none");
    playKeySoundPreview("none");
    expect(oscillators).toHaveLength(0);
  });

  it("produit des fréquences et paramètres distincts entre 'hit' et 'miss' pour chaque set actif", () => {
    const activeSets: Array<Exclude<KeySoundSet, "none">> = [
      "mechanical",
      "typewriter",
      "retro",
      "soft",
    ];

    for (const set of activeSets) {
      resetAudioContextForTests();
      const hitMock = installMockAudioContext();
      playKeySound("hit", set);
      expect(hitMock.oscillators.length).toBeGreaterThan(0);

      resetAudioContextForTests();
      const missMock = installMockAudioContext();
      playKeySound("miss", set);
      expect(missMock.oscillators.length).toBeGreaterThan(0);

      const hitPrimary = hitMock.oscillators[0];
      const missPrimary = missMock.oscillators[0];

      expect(hitPrimary.startFreqs[0]?.value).not.toBe(missPrimary.startFreqs[0]?.value);
      expect(hitPrimary.rampFreqs[0]?.value).not.toBe(missPrimary.rampFreqs[0]?.value);
      expect(hitPrimary.stoppedAt! - hitPrimary.startedAt!).toBeLessThan(
        missPrimary.stoppedAt! - missPrimary.startedAt!,
      );
    }
  });

  it("joue un aperçu du set choisi via playKeySoundPreview et réveille un contexte suspendu", () => {
    const { oscillators, resumeMock } = installMockAudioContext("suspended");
    playKeySoundPreview("retro");
    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe("square");
    expect(oscillators[0].startFreqs[0]?.value).toBe(660);
    expect(oscillators[0].rampFreqs[0]?.value).toBe(880);
  });

  it("échoue silencieusement si AudioContext est absent ou lève une exception", () => {
    vi.stubGlobal("AudioContext", undefined);
    if (typeof window !== "undefined") {
      (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
      (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = undefined;
    }

    expect(() => playKeySound("hit", "mechanical")).not.toThrow();
    expect(() => playKeySound("miss", "typewriter")).not.toThrow();

    class ThrowingAudioContext {
      constructor() {
        throw new Error("AudioContext blocked by policy");
      }
    }
    vi.stubGlobal("AudioContext", ThrowingAudioContext);
    if (typeof window !== "undefined") {
      (window as unknown as { AudioContext: unknown }).AudioContext = ThrowingAudioContext;
    }
    resetAudioContextForTests();

    expect(() => playKeySound("hit", "soft")).not.toThrow();
    expect(() => playKeySoundPreview("mechanical")).not.toThrow();
  });
});
