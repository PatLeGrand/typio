import { ImageIcon, Play } from "lucide-react";

type HomeMediaPlaceholderProps = {
  kind: "image" | "video";
  label: string;
  title: string;
  description: string;
  note?: string;
  tone?: "accent" | "mint" | "sand";
  className?: string;
};

const toneClasses = {
  accent: "bg-accent-panel",
  mint: "bg-island-mint",
  sand: "bg-island-sand",
} as const;

export function HomeMediaPlaceholder({
  kind,
  label,
  title,
  description,
  note,
  tone = "accent",
  className = "",
}: HomeMediaPlaceholderProps) {
  const Icon = kind === "video" ? Play : ImageIcon;
  const dimensions = kind === "video" ? "aspect-video" : "min-h-72 sm:min-h-[420px]";

  return (
    <div
      className={`relative flex ${dimensions} items-center justify-center overflow-hidden rounded-[28px] p-7 sm:p-8 ${toneClasses[tone]} ${className}`}
    >
      <div className="absolute left-7 top-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
        {label}
      </div>
      <div className="flex w-full max-w-[440px] flex-col items-center gap-4 rounded-2xl border border-border px-6 py-10 text-center sm:min-h-[230px] sm:justify-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface text-accent-text sm:size-16">
          <Icon aria-hidden="true" className={kind === "video" ? "size-6" : "size-5"} />
        </span>
        <p className="text-lg font-medium text-foreground sm:text-xl">{title}</p>
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {note ? <p className="absolute bottom-5 right-7 text-xs text-muted">{note}</p> : null}
    </div>
  );
}
