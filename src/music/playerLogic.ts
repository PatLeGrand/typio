export type MusicPreferences = {
  volume: number;
  muted: boolean;
  collapsed: boolean;
};

const defaults: MusicPreferences = { volume: 0.5, muted: false, collapsed: true };

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

    const { volume, muted, collapsed } = value as Partial<Record<keyof MusicPreferences, unknown>>;
    return {
      volume: typeof volume === "number" && volume >= 0 && volume <= 1 ? volume : defaults.volume,
      muted: typeof muted === "boolean" ? muted : defaults.muted,
      collapsed: typeof collapsed === "boolean" ? collapsed : defaults.collapsed,
    };
  } catch {
    return defaults;
  }
}
