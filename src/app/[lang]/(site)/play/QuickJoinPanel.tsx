import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";

type QuickJoinPanelProps = {
  labels: Dictionary["room"]["play"]["quick"];
  /** Message de `room.errors.NO_ROOM_AVAILABLE`. */
  noRoomMessage: string;
  /** Aucune salle n'était disponible au dernier essai. */
  noRoom: boolean;
  /** Invité : pas de création de salle (AUTH-03), seulement l'état vide. */
  isGuest: boolean;
  disabled: boolean;
  onQuickJoin: () => void;
  onCreatePublic: () => void;
};

/** « Faire une course » (JOIN-03) : partie rapide, ou création d'une salle publique si aucune n'est disponible. */
export function QuickJoinPanel({ labels, noRoomMessage, noRoom, isGuest, disabled, onQuickJoin, onCreatePublic }: QuickJoinPanelProps) {
  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
      <p className="text-muted-strong">{labels.description}</p>
      <Button disabled={disabled} onClick={onQuickJoin}>
        {labels.button}
      </Button>
      {noRoom ? (
        <div role="status" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">{noRoomMessage}</p>
          {isGuest ? null : (
            <Button variant="secondary" disabled={disabled} onClick={onCreatePublic}>
              {labels.createPublic}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
