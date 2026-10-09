import { useId } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";

type CreateRoomPanelProps = {
  labels: Dictionary["room"]["play"]["create"];
  /** Invité : création impossible, la raison est affichée (SALLE-12). */
  isGuest: boolean;
  /** Déjà dans une salle, ou création en cours. */
  disabled: boolean;
  onCreate: () => void;
};

/** « Créer une salle » (SALLE-1), réservé aux membres (SALLE-12). */
export function CreateRoomPanel({ labels, isGuest, disabled, onCreate }: CreateRoomPanelProps) {
  const noticeId = useId();

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
      <p className="text-muted-strong">{labels.description}</p>
      {isGuest ? (
        <p id={noticeId} className="text-sm font-semibold text-danger">
          {labels.guestNotice}
        </p>
      ) : null}
      <Button onClick={onCreate} disabled={disabled || isGuest} aria-describedby={isGuest ? noticeId : undefined}>
        {labels.button}
      </Button>
    </Card>
  );
}
