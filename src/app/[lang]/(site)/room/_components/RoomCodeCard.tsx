"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";

type RoomCodeCardProps = {
  code: string;
  labels: Dictionary["room"]["code"];
};

type CopyFeedback = "none" | "copied" | "selected";

/**
 * Code de la salle en grand (SALLE-4) avec un bouton pour le copier. Sans API presse-papiers
 * (contexte non sécurisé, vieux navigateur) ou si elle refuse, le code est sélectionné pour
 * que l'élève le copie lui-même.
 */
export function RoomCodeCard({ code, labels }: RoomCodeCardProps) {
  const codeRef = useRef<HTMLParagraphElement>(null);
  const [feedback, setFeedback] = useState<CopyFeedback>("none");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("copied");
    } catch {
      if (codeRef.current) window.getSelection()?.selectAllChildren(codeRef.current);
      setFeedback("selected");
    }
  }

  return (
    <Card className="flex flex-col items-start gap-4 border border-border p-6">
      <h2 className="text-sm font-semibold text-muted-strong">{labels.label}</h2>
      <p ref={codeRef} className="font-mono text-5xl font-bold tracking-widest text-foreground">
        {code}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void copy()}>
          {labels.copy}
        </Button>
        <span aria-live="polite" className="text-sm font-semibold text-success">
          {feedback === "copied" ? labels.copied : null}
        </span>
        <span aria-live="polite" className="text-sm text-muted-strong">
          {feedback === "selected" ? labels.copyFallback : null}
        </span>
      </div>
    </Card>
  );
}
