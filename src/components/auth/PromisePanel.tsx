import { Check, Timer, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { Badge } from "../Badge";
import { Card } from "../Card";

type PromisePanelProps = {
  labels: Dictionary["promise"];
  /** Emplacement de l'illustration : mascotte (connexion, invité) ou île de progression (inscription). */
  children: ReactNode;
};

/** Contenu du panneau violet : promesse du produit, illustration, carte de conseil et bénéfices. */
export function PromisePanel({ labels, children }: PromisePanelProps) {
  const benefits = [labels.benefits.ownPace, labels.benefits.noPressure, labels.benefits.playful];

  return (
    <div className="flex w-full flex-col items-center justify-between gap-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Badge tone="surface" icon={<Zap />}>
          {labels.badge}
        </Badge>
        <h2 className="text-4xl font-extrabold leading-[1.08] text-foreground xl:text-5xl">
          {labels.titleLine1}
          <br />
          <span className="text-accent-text">{labels.titleLine2}</span>
        </h2>
        <p className="text-base text-muted-strong">{labels.description}</p>
      </div>
      <div className="flex w-full flex-1 items-center justify-center">{children}</div>
      <div className="flex w-full max-w-[610px] flex-col items-center gap-5">
        <Card className="flex w-full items-center gap-4 p-5 text-left">
          <span
            aria-hidden="true"
            className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-key-yellow text-key-ink"
          >
            <Timer className="size-7" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-bold text-foreground">{labels.tipTitle}</p>
            <p className="text-sm text-muted">{labels.tipText}</p>
          </div>
        </Card>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-strong">
          {benefits.map((benefit) => (
            <li key={benefit} className="inline-flex items-center gap-1.5">
              <Check aria-hidden="true" className="size-3.5 text-accent-text" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
