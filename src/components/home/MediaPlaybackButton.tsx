import { Pause, Play } from "lucide-react";

type MediaPlaybackButtonProps = {
  playing: boolean;
  label: string;
  onClick: () => void;
};

export function MediaPlaybackButton({ playing, label, onClick }: MediaPlaybackButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="icon-enter icon-enter-media absolute bottom-3 right-3 inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {playing ? <Pause aria-hidden="true" className="size-5" /> : <Play aria-hidden="true" className="size-5" />}
    </button>
  );
}
