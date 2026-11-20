import { Award, Sparkles, Timer } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

type ProgressIslandProps = {
  labels: Dictionary["island"];
};

const STEPS = [1, 2, 3] as const;

/**
 * Tableau de progression sur piste du panneau d'inscription, dessiné en CSS seulement (aucune
 * image) : une seule surface calme sur fond sombre, jalonnée d'un couloir en trois étapes et
 * de deux repères. Les formes et icônes sont décoratives (`aria-hidden`) ; les textes restent
 * dans le DOM et sont lus normalement.
 */
export function ProgressIsland({ labels }: ProgressIslandProps) {
  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-screen-border bg-screen-surface p-6 text-left">
      <div className="flex items-start justify-between gap-4 border-b border-screen-border pb-5">
        <div className="min-w-0 flex flex-col gap-1">
          <p className="text-base font-bold text-screen-text">{labels.zoneTitle}</p>
          <p className="text-sm leading-snug text-screen-muted">{labels.zoneText}</p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-key-mint text-key-ink"
        >
          <Sparkles className="size-5" />
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-display text-3xl font-black leading-none text-screen-text">{labels.progressTitle}</p>
          <p className="text-sm leading-snug text-screen-muted">{labels.progressText}</p>
        </div>

        <div aria-hidden="true" className="flex w-full items-center gap-3 py-1">
          {STEPS.map((step) => (
            <div key={step} className={`flex items-center gap-3 ${step === 1 ? "" : "flex-1"}`}>
              {step === 1 ? null : (
                <span className="h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_8px,transparent_8px_16px)] opacity-40" />
              )}
              <span
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                  step === 1
                    ? "bg-key-yellow text-key-ink"
                    : "border border-screen-border bg-screen text-screen-muted"
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-screen-border pt-4">
        <div className="inline-flex items-center gap-2">
          <Timer aria-hidden="true" className="size-4 shrink-0 text-key-yellow" />
          <p className="text-xs font-semibold text-screen-text">{labels.perDay}</p>
        </div>
        <div className="inline-flex items-center gap-2">
          <Award aria-hidden="true" className="size-4 shrink-0 text-key-mint" />
          <p className="text-xs font-semibold text-screen-text">{labels.rewards}</p>
        </div>
      </div>
    </div>
  );
}
