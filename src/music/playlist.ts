export type MusicTrack = {
  file: `${string}.mp3` | `${string}.ogg`;
  title: string;
  artist: string;
  credit: string;
};

const artist = "Lofi";
const credit = "Diffusion autorisée";

export const playlist: readonly MusicTrack[] = [
  { file: "all-i-want.mp3", title: "all I want", artist, credit },
  { file: "backyard-memories.mp3", title: "Backyard Memories", artist, credit },
  { file: "flood.mp3", title: "Flood", artist, credit },
  { file: "horsin-around.mp3", title: "horsin around", artist, credit },
  { file: "inside-out.mp3", title: "Inside Out", artist, credit },
  { file: "introspect.mp3", title: "Introspect", artist, credit },
  { file: "kiwi.mp3", title: "Kiwi", artist, credit },
  { file: "libbys-song.mp3", title: "libby’s song", artist, credit },
  { file: "lifes-short.mp3", title: "Life’s Short", artist, credit },
  { file: "lurelin-village.mp3", title: "lurelin village", artist, credit },
  { file: "perfect-light.mp3", title: "Perfect Light", artist, credit },
  { file: "seasons.mp3", title: "Seasons", artist, credit },
  { file: "silent-leaves.mp3", title: "Silent Leaves", artist, credit },
  { file: "trusted.mp3", title: "Trusted", artist, credit },
  { file: "writing-all-day.mp3", title: "Writing All Day", artist, credit },
];
