export const KEY_SOUND_SETS = ["mechanical", "typewriter", "retro", "soft", "none"] as const;
export type KeySoundSet = (typeof KEY_SOUND_SETS)[number];
export const DEFAULT_KEY_SOUND_SET: KeySoundSet = "mechanical";
export const KEY_SOUND_STORAGE_KEY = "typio:keySoundSet";
export const KEY_SOUND_CHANGE_EVENT = "typio:key-sound-change";

const KEY_SOUND_SET_LOOKUP = new Set<string>(KEY_SOUND_SETS);

export function isKeySoundSet(value: unknown): value is KeySoundSet {
  return typeof value === "string" && KEY_SOUND_SET_LOOKUP.has(value);
}

export function readKeySoundSet(storage?: Pick<Storage, "getItem"> | null): KeySoundSet {
  try {
    const resolvedStorage =
      storage !== undefined
        ? storage
        : typeof window !== "undefined"
          ? window.localStorage
          : null;
    if (!resolvedStorage) {
      return DEFAULT_KEY_SOUND_SET;
    }
    const raw = resolvedStorage.getItem(KEY_SOUND_STORAGE_KEY);
    return isKeySoundSet(raw) ? raw : DEFAULT_KEY_SOUND_SET;
  } catch {
    return DEFAULT_KEY_SOUND_SET;
  }
}

export function writeKeySoundSet(
  set: KeySoundSet,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  try {
    const resolvedStorage =
      storage !== undefined
        ? storage
        : typeof window !== "undefined"
          ? window.localStorage
          : null;
    resolvedStorage?.setItem(KEY_SOUND_STORAGE_KEY, set);
  } catch {
    // Ignore quota or storage access errors
  }

  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(KEY_SOUND_CHANGE_EVENT, { detail: set }));
    }
  } catch {
    // Ignore event dispatch errors in restricted environments
  }
}

type ToneSpec = {
  type: OscillatorType;
  startFreq: number;
  endFreq: number;
  durationSec: number;
  peakGain: number;
  delaySec?: number;
};

const SOUND_PRESETS: Record<Exclude<KeySoundSet, "none">, { hit: ToneSpec[]; miss: ToneSpec[] }> = {
  mechanical: {
    hit: [
      {
        type: "triangle",
        startFreq: 180,
        endFreq: 60,
        durationSec: 0.035,
        peakGain: 0.18,
      },
      {
        type: "sine",
        startFreq: 1800,
        endFreq: 900,
        durationSec: 0.012,
        peakGain: 0.08,
      },
    ],
    miss: [
      {
        type: "sawtooth",
        startFreq: 110,
        endFreq: 55,
        durationSec: 0.075,
        peakGain: 0.2,
      },
    ],
  },
  typewriter: {
    hit: [
      {
        type: "square",
        startFreq: 320,
        endFreq: 90,
        durationSec: 0.04,
        peakGain: 0.15,
      },
      {
        type: "triangle",
        startFreq: 2400,
        endFreq: 1200,
        durationSec: 0.015,
        peakGain: 0.1,
      },
    ],
    miss: [
      {
        type: "triangle",
        startFreq: 220,
        endFreq: 165,
        durationSec: 0.085,
        peakGain: 0.15,
      },
      {
        type: "square",
        startFreq: 233,
        endFreq: 175,
        durationSec: 0.085,
        peakGain: 0.11,
      },
    ],
  },
  retro: {
    hit: [
      {
        type: "square",
        startFreq: 660,
        endFreq: 880,
        durationSec: 0.035,
        peakGain: 0.13,
      },
    ],
    miss: [
      {
        type: "sawtooth",
        startFreq: 190,
        endFreq: 110,
        durationSec: 0.08,
        peakGain: 0.17,
      },
    ],
  },
  soft: {
    hit: [
      {
        type: "sine",
        startFreq: 380,
        endFreq: 520,
        durationSec: 0.03,
        peakGain: 0.14,
      },
    ],
    miss: [
      {
        type: "sine",
        startFreq: 160,
        endFreq: 115,
        durationSec: 0.07,
        peakGain: 0.16,
      },
    ],
  },
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) {
    return sharedAudioContext;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  sharedAudioContext = new AudioCtx();
  return sharedAudioContext;
}

function scheduleTone(ctx: AudioContext, spec: ToneSpec): void {
  const startTime = ctx.currentTime + (spec.delaySec ?? 0);
  const stopTime = startTime + spec.durationSec;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.startFreq, startTime);
  if (spec.endFreq !== spec.startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.endFreq), stopTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(spec.peakGain, startTime + Math.min(0.004, spec.durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(stopTime);
}

export function playKeySound(outcome: "hit" | "miss", set?: KeySoundSet): void {
  const activeSet = set ?? readKeySoundSet();
  if (activeSet === "none") {
    return;
  }

  const preset = SOUND_PRESETS[activeSet];
  if (!preset) {
    return;
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      void Promise.resolve(ctx.resume()).catch(() => {});
    }
    const tones = outcome === "hit" ? preset.hit : preset.miss;
    for (const tone of tones) {
      scheduleTone(ctx, tone);
    }
  } catch {
    // Fail silently when Web Audio API is blocked or unavailable
  }
}

export function playKeySoundPreview(set: KeySoundSet): void {
  playKeySound("hit", set);
}

export function resetAudioContextForTests(): void {
  sharedAudioContext = null;
}
