export type MusicTrack = {
  file: `${string}.mp3` | `${string}.ogg`;
  title: string;
  artist: string;
  credit: string;
};

export const playlist: readonly MusicTrack[] = [];
