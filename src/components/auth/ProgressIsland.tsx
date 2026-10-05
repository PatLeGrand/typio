import { Award, Sparkles, Star, Timer } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { Card } from "../Card";

type ProgressIslandProps = {
  labels: Dictionary["island"];
};

const STEPS = [1, 2, 3] as const;

/**
 * « Île dactylo » du panneau d'inscription, dessinée en CSS seulement (aucune image) : carte
 * sable, colline menthe, montagne menthe avec son étoile, chemin en trois étapes et deux
 * cartes. Les formes et les icônes sont décoratives (`aria-hidden`) ; les textes, eux, restent
 * dans le DOM et sont lus normalement.
 */
export function ProgressIsland({ labels }: ProgressIslandProps) {
  return (
    <div className="relative w-full max-w-[610px] rounded-card border border-border bg-island-sand p-4 text-left sm:p-5">
      <Card className="flex items-center gap-3 p-3">
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-key-mint text-key-ink"
        >
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{labels.zoneTitle}</p>
          <p className="text-xs text-muted">{labels.zoneText}</p>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-3 rounded-card bg-island-mint p-3 sm:p-4">
        <div className="flex flex-col items-center gap-3 rounded-card bg-key-mint px-4 pb-4 pt-5 text-center text-key-ink">
          <span
            aria-hidden="true"
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-key-yellow text-key-ink"
          >
            <Star className="size-5" />
          </span>
          <p className="text-base font-bold">{labels.progressTitle}</p>
          <div aria-hidden="true" className="flex w-full items-center gap-2">
            {STEPS.map((step) => (
              <div key={step} className={`flex items-center gap-2 ${step === 1 ? "" : "flex-1"}`}>
                {step === 1 ? null : <span className="h-0.5 flex-1 rounded-full bg-accent" />}
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    step === 1 ? "bg-accent text-accent-foreground" : "border-2 border-accent bg-surface text-accent-text"
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs">{labels.progressText}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center gap-2 p-3 text-center">
            <span
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center rounded-full bg-key-yellow text-key-ink"
            >
              <Timer className="size-4" />
            </span>
            <p className="text-xs font-bold text-foreground">{labels.perDay}</p>
          </Card>
          <Card className="flex flex-col items-center gap-2 p-3 text-center">
            <span
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center rounded-full bg-key-mint text-key-ink"
            >
              <Award className="size-4" />
            </span>
            <p className="text-xs font-bold text-foreground">{labels.rewards}</p>
          </Card>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-4 inline-flex size-12 items-center justify-center rounded-2xl border-b-4 border-key-ink/20 bg-key-yellow text-key-ink shadow-soft"
      >
        <Star className="size-5" />
      </span>
    </div>
  );
}
