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
  /** Textes des réglages de course, partagés avec la page de paramètres. */
  settingsLabels: Dictionary["raceSettings"];
  lang: string;
  /** Dernier refus ou échec, affiché traduit. */
  error: ClientRoomErrorCode | null;
  /** Départ en cours : le bouton « Quitter » est désactivé. */
  leaving: boolean;
  onLeave: () => void;
  /** Envoie le patch ; la promesse se résout à la réponse du serveur. */
  onConfigChange: (patch: RoomConfigPatch) => Promise<unknown>;
};

/**
 * Salle d'attente une fois rejointe : code, participants, configuration. Pas de bouton de
 * lancement ni d'ajout de joueur : hors du périmètre du checkpoint 1.
 */
export function RoomView({ room, userId, labels, settingsLabels, lang, error, leaving, onLeave, onConfigChange }: RoomViewProps) {
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
      <div className="flex flex-col gap-6">
        <ParticipantList room={room} currentUserId={userId} labels={labels.participants} />
        <RoomConfigPanel
          config={room.config}
          editable={room.hostId === userId}
          lang={lang}
          labels={labels.config}
          settingsLabels={settingsLabels}
          onChange={onConfigChange}
        />
      </div>
    </>
  );
}
