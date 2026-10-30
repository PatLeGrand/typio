import { useState } from "react";
import { Button } from "@/components/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RoomConfigPatch, RoomState } from "@/realtime/protocol";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { InvitePanel } from "./InvitePanel";
import { ParticipantList } from "./ParticipantList";
import { RoomCodeCard } from "./RoomCodeCard";
import { RoomConfigPanel } from "./RoomConfigPanel";
import type { UseRoom } from "@/realtime/useRoom";
import { RoomRaceView } from "./RoomRaceView";
import { RoomError } from "./RoomError";

type RoomViewProps = {
  room: RoomState;
  raceLabels: Dictionary["raceScreen"];
  session: UseRoom;
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

export function RoomView({ room, userId, labels, settingsLabels, lang, error, leaving, onLeave, onConfigChange, raceLabels, session }: RoomViewProps) {
  const [pending, setPending] = useState(false);
  const humans = room.participants.filter((p) => p.role === "runner").length;
  const enoughRunners = humans > 0 && humans + room.config.botCount >= 2;
  async function startRace() {
    setPending(true);
    try { await session.startRace(); } finally { setPending(false); }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{room.status === "waiting" ? labels.title : room.status === "results" ? labels.resultsTitle : labels.raceTitle}</h1>
        <Button variant="secondary" onClick={onLeave} disabled={leaving}>
          {labels.leave}
        </Button>
      </div>
      {error ? <RoomError code={error} messages={labels.errors} /> : null}
      <RoomCodeCard code={room.code} labels={labels.code} />
      {room.status === "waiting" ? <div className="flex flex-col gap-6">
        <ParticipantList room={room} currentUserId={userId} labels={labels.participants} onKick={room.hostId === userId ? session.kick : undefined} />
        {room.hostId === userId ? <InvitePanel invites={session.invites} lang={lang} labels={labels.invites} errors={labels.errors} onCreate={session.createInvite} /> : null}
        <RoomConfigPanel
          config={room.config}
          editable={room.hostId === userId}
          lang={lang}
          labels={labels.config}
          settingsLabels={settingsLabels}
          onChange={onConfigChange}
        />
        {room.hostId === userId ? <div className="flex flex-col items-start gap-2">
          <Button disabled={pending || !enoughRunners || session.connection !== "connected"} aria-describedby={!enoughRunners ? "race-start-reason" : undefined} onClick={() => void startRace()}>{labels.race.start}</Button>
          {!enoughRunners ? <p id="race-start-reason">{labels.errors.NOT_ENOUGH_RUNNERS}</p> : null}
        </div> : null}
      </div> : <RoomRaceView key={room.code} room={room} userId={userId} lang={lang} labels={labels.race} raceLabels={raceLabels} session={session} />}
    </>
  );
}
