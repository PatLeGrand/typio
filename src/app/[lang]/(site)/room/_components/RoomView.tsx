import { Button } from "@/components/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RoomConfigPatch, RoomState } from "@/realtime/protocol";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { ParticipantList } from "./ParticipantList";
import { RoomCodeCard } from "./RoomCodeCard";
import { RoomConfigPanel } from "./RoomConfigPanel";
import { RoomError } from "./RoomError";

type RoomViewProps = {
  room: RoomState;
  /** `users.id` de l'utilisateur courant : il est hôte si c'est `room.hostId`. */
  userId: string;
  labels: Dictionary["room"];
  /** Dernier refus ou échec, affiché traduit. */
  error: ClientRoomErrorCode | null;
  /** Départ en cours : le bouton « Quitter » est désactivé. */
  leaving: boolean;
  onLeave: () => void;
  onConfigChange: (patch: RoomConfigPatch) => void;
};

/**
 * Salle d'attente une fois rejointe : code, participants, configuration. Pas de bouton de
 * lancement ni d'ajout de joueur : hors du périmètre du checkpoint 1.
 */
export function RoomView({ room, userId, labels, error, leaving, onLeave, onConfigChange }: RoomViewProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{labels.title}</h1>
        <Button variant="secondary" onClick={onLeave} disabled={leaving}>
          {labels.leave}
        </Button>
      </div>
      {error ? <RoomError code={error} messages={labels.errors} /> : null}
      <RoomCodeCard code={room.code} labels={labels.code} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ParticipantList room={room} currentUserId={userId} labels={labels.participants} />
        <RoomConfigPanel
          config={room.config}
          editable={room.hostId === userId}
          labels={labels.config}
          onChange={onConfigChange}
        />
      </div>
    </>
  );
}
