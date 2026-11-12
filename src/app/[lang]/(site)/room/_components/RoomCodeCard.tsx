"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";

type RoomCodeCardProps = {
  code: string;
  compact?: boolean;
  labels: Dictionary["room"]["code"];
};

type CopyFeedback = "none" | "copied" | "selected";

/**
 * Code de la salle en grand (SALLE-02, JOIN-01) avec un bouton pour le copier. Sans API presse-papiers
 * (contexte non sécurisé, vieux navigateur) ou si elle refuse, le code est sélectionné pour
 * que l'élève le copie lui-même.
 */
export function RoomCodeCard({ code, labels, compact = false }: RoomCodeCardProps) {
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

  const Container = compact ? "div" : Card;
  return (
    <Container className={compact ? "mb-3 grid shrink-0 grid-cols-[1fr_auto] items-center gap-2 border-b border-border pb-3" : "flex flex-col items-start gap-4 border border-border p-6"}>
      <h2 className={compact ? "sr-only" : "text-sm font-semibold text-muted-strong"}>{labels.label}</h2>
      <p ref={codeRef} translate="no" className={`max-w-full break-all font-mono font-bold tracking-widest text-foreground ${compact ? "text-xl" : "text-5xl"}`}>
        {code}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" aria-label={compact ? labels.copy : undefined} title={compact ? feedback === "selected" ? labels.copyFallback : feedback === "copied" ? labels.copied : labels.copy : undefined} onClick={() => void copy()}>
          {compact ? feedback === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" /> : labels.copy}
        </Button>
        <span aria-live="polite" className={compact ? "sr-only" : "text-sm font-semibold text-success"}>
          {feedback === "copied" ? labels.copied : null}
        </span>
        <span aria-live="polite" className={compact ? "sr-only" : "text-sm text-muted-strong"}>
          {feedback === "selected" ? labels.copyFallback : null}
        </span>
      </div>
    </Container>
  );
}
