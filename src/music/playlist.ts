export type MusicTrack = {
  file: `${string}.mp3` | `${string}.ogg`;
  title: string;
  artist: string;
};

const artist = "Lofi";

export const playlist: readonly MusicTrack[] = [
  { file: "all-i-want.mp3", title: "all I want", artist },
  { file: "backyard-memories.mp3", title: "Backyard Memories", artist },
  { file: "flood.mp3", title: "Flood", artist },
  { file: "horsin-around.mp3", title: "horsin around", artist },
  { file: "inside-out.mp3", title: "Inside Out", artist },
  { file: "introspect.mp3", title: "Introspect", artist },
  { file: "kiwi.mp3", title: "Kiwi", artist },
  { file: "libbys-song.mp3", title: "libby’s song", artist },
  { file: "lifes-short.mp3", title: "Life’s Short", artist },
  { file: "lurelin-village.mp3", title: "lurelin village", artist },
  { file: "perfect-light.mp3", title: "Perfect Light", artist },
  { file: "seasons.mp3", title: "Seasons", artist },
  { file: "silent-leaves.mp3", title: "Silent Leaves", artist },
  { file: "trusted.mp3", title: "Trusted", artist },
  { file: "writing-all-day.mp3", title: "Writing All Day", artist },
];
