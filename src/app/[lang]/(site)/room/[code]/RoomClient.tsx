"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import type { ParticipantRole, RoomConfigPatch } from "@/realtime/protocol";
import { isRoomCode } from "@/realtime/roomCode";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { useLoginRedirect } from "@/realtime/useLoginRedirect";
import { useRoom } from "@/realtime/useRoom";
import { ConnectionBanner } from "../_components/ConnectionBanner";
import { RoomUnavailable } from "../_components/RoomUnavailable";
import { RoomView } from "../_components/RoomView";

type RoomClientProps = {
  /** Code de l'URL, déjà normalisé par la page. */
  code: string;
  /** Rôle demandé à l'arrivée (`?role=`), déjà validé. */
  role: ParticipantRole;
  locale: Locale;
  /** `users.id` de la session, lue côté serveur par la page. */
  userId: string;
  labels: Dictionary["room"];
};

/**
 * Salle d'attente (SALLE-7, SALLE-10, SALLE-13, SALLE-15). Rejoint la salle de l'URL une
 * seule fois par montage (D6) ; quitter la page sans « Quitter » ne quitte pas la salle (D7).
 */
export function RoomClient({ code, role, locale, userId, labels }: RoomClientProps) {
  const router = useRouter();
  const { connection, room, error, join, updateConfig, leave, clearError } = useRoom(userId);
  useLoginRedirect(connection, locale);

  const playHref = prefixWithLocale("/play", locale);
  const validCode = isRoomCode(code);
  const inThisRoom = room !== null && room.code === code;

  const joinStarted = useRef(false);
  const [joinError, setJoinError] = useState<ClientRoomErrorCode | null>(null);
  const [wasInRoom, setWasInRoom] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // « Ajustement d'état pendant le rendu » : retient qu'on a bien fait partie de cette salle,
  // pour distinguer « pas encore arrivé » de « n'en fait plus partie ».
  if (inThisRoom && !wasInRoom) setWasInRoom(true);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!validCode || connection !== "connected" || joinStarted.current) return;
    joinStarted.current = true;
    if (inThisRoom) return;
    void join({ code, role }).then((result) => {
      if (!result.ok) setJoinError(result.error);
    });
  }, [validCode, connection, inThisRoom, join, code, role]);

  async function handleLeave(): Promise<void> {
    setLeaving(true);
    const result = await leave();
    if (result.ok) router.replace(playHref);
    else setLeaving(false);
  }

  function handleConfigChange(patch: RoomConfigPatch): void {
    void updateConfig(patch);
  }

  const unavailable: ClientRoomErrorCode | null = !validCode
    ? "INVALID_CODE"
    : (joinError ??
      (wasInRoom && !inThisRoom && !leaving && connection === "connected" ? "NOT_IN_ROOM" : null));

  return (
    <div className="flex flex-col gap-6">
      <ConnectionBanner status={connection} offlineLabel={labels.connection.offline} />
      {unavailable ? (
        <RoomUnavailable code={unavailable} labels={labels} playHref={playHref} />
      ) : inThisRoom ? (
        <RoomView
          room={room}
          userId={userId}
          labels={labels}
          error={error}
          leaving={leaving}
          onLeave={() => void handleLeave()}
          onConfigChange={handleConfigChange}
        />
      ) : (
        <p className="text-muted-strong">{labels.loading}</p>
      )}
    </div>
  );
}
