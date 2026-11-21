export type MusicPreferences = {
  volume: number;
  muted: boolean;
  collapsed: boolean;
  paused: boolean;
};

const defaults: MusicPreferences = { volume: 0.5, muted: false, collapsed: true, paused: false };

export function nextTrackIndex(index: number, direction: 1 | -1, length: number): number {
  return length === 0 ? 0 : (index + direction + length) % length;
}

export function playbackVolume(volume: number, racing: boolean): number {
  return racing ? volume * 0.3 : volume;
}

export function readMusicPreferences(read: () => string | null): MusicPreferences {
  try {
    const raw = read();
    if (raw === null) return defaults;

    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object") return defaults;

    const { volume, muted, collapsed, paused } = value as Partial<Record<keyof MusicPreferences, unknown>>;
    return {
      volume: typeof volume === "number" && volume >= 0 && volume <= 1 ? volume : defaults.volume,
      muted: typeof muted === "boolean" ? muted : defaults.muted,
      collapsed: typeof collapsed === "boolean" ? collapsed : defaults.collapsed,
      paused: typeof paused === "boolean" ? paused : defaults.paused,
    };
  } catch {
    return defaults;
  }
}

/** Première visite : le stockage répond, mais aucune préférence n'y est encore mémorisée. */
export function isFirstVisit(read: () => string | null): boolean {
  try {
    return read() === null;
  } catch {
    // Stockage bloqué : impossible de mémoriser l'accueil, on ne le rejoue pas à chaque page.
    return false;
  }
}

/** Délai avant repli automatique, ou null si le lecteur ne doit pas se replier seul. */
export function autoCollapseDelay(state: { open: boolean; welcoming: boolean; holding: boolean }): number | null {
  if (!state.open || state.holding) return null;
  return state.welcoming ? 4000 : 3000;
}
