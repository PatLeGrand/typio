import { Check, Timer } from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

type PromisePanelProps = {
  labels: Dictionary["promise"];
  /** Emplacement de l'illustration : mascotte (connexion, invité) ou progression sur piste (inscription). */
  children: ReactNode;
};

/** Contenu du panneau « stade de nuit » : promesse en Big Shoulders, scène centrale, conseil et bénéfices. */
export function PromisePanel({ labels, children }: PromisePanelProps) {
  const benefits = [labels.benefits.ownPace, labels.benefits.noPressure, labels.benefits.playful];

  return (
    <div className="flex w-full flex-col justify-between gap-8 text-left">
      <div className="flex flex-col items-start gap-4">
        <p className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-screen-muted">
          <span aria-hidden="true" className="h-0.5 w-7 bg-track-accent" />
          {labels.badge}
        </p>
        <h2 className="text-balance font-display text-[clamp(2.75rem,3.8vw,4.25rem)] font-black leading-[0.88] tracking-[-0.01em] text-screen-text">
          {labels.titleLine1}
          <br />
          <span className="text-key-yellow">{labels.titleLine2}</span>
        </h2>
        <p className="max-w-[34ch] text-pretty text-base leading-relaxed text-screen-muted">{labels.description}</p>
      </div>
      <div className="flex w-full flex-1 items-center justify-center py-2">{children}</div>
      <div className="flex w-full flex-col gap-5">
        <div className="flex w-full items-center gap-4 rounded-2xl border border-screen-border bg-screen-surface px-5 py-4">
          <span
            aria-hidden="true"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-key-yellow text-key-ink"
          >
            <Timer className="size-5" />
          </span>
          <div className="min-w-0 flex flex-col gap-0.5">
            <p className="text-sm font-bold text-screen-text">{labels.tipTitle}</p>
            <p className="text-sm leading-snug text-screen-muted">{labels.tipText}</p>
          </div>
        </div>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-screen-muted">
          {benefits.map((benefit) => (
            <li key={benefit} className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="size-3.5 shrink-0 text-key-yellow" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
