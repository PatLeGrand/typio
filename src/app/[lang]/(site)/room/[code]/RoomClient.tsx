"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  settingsLabels: Dictionary["raceSettings"];
};

/**
 * Salle d'attente (SALLE-7, SALLE-10, SALLE-13, SALLE-15). Rejoint la salle de l'URL une
 * seule fois par montage (D6) ; quitter la page sans « Quitter » ne quitte pas la salle (D7).
 */
export function RoomClient({ code, role, locale, userId, labels, settingsLabels }: RoomClientProps) {
  const router = useRouter();
  const { connection, room, error, join, updateConfig, leave, clearError } = useRoom(userId);
  useLoginRedirect(connection, locale);

  const playHref = prefixWithLocale("/play", locale);
  const validCode = isRoomCode(code);
  const inThisRoom = room !== null && room.code === code;

  // `joinPending` : un `join` reste à émettre (une fois par montage, D6). Il redevient vrai
  // après un échec passager, pour un seul nouvel essai à la prochaine connexion.
  const joinPending = useRef(true);
  const joinRetriesLeft = useRef(1);
  const [joinError, setJoinError] = useState<ClientRoomErrorCode | null>(null);
  const [wasInRoom, setWasInRoom] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Le départ a été demandé, même si l'accusé s'est perdu : un état sans nous veut dire « parti ».
  const [leaveRequested, setLeaveRequested] = useState(false);
  const redirected = useRef(false);

  // « Ajustement d'état pendant le rendu » : retient qu'on a bien fait partie de cette salle,
  // pour distinguer « pas encore arrivé » de « n'en fait plus partie ».
  if (inThisRoom && !wasInRoom) setWasInRoom(true);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (inThisRoom) {
      // Déjà dedans (ré-attachement du serveur, accusé tardif) : rien à rejoindre.
      joinPending.current = false;
      return;
    }
    if (!validCode || connection !== "connected" || !joinPending.current) return;
    joinPending.current = false;
    void join({ code, role }).then((result) => {
      if (result.ok) {
        setJoinError(null);
        return;
      }
      const transient = result.error === "OFFLINE" || result.error === "TIMEOUT";
      if (transient && joinRetriesLeft.current > 0) {
        joinRetriesLeft.current -= 1;
        joinPending.current = true;
      }
      setJoinError(result.error);
    });
  }, [validCode, connection, inThisRoom, join, code, role]);

  const goToPlay = useCallback(() => {
    if (redirected.current) return;
    redirected.current = true;
    router.replace(playHref);
  }, [router, playHref]);

  useEffect(() => {
    if (leaveRequested && wasInRoom && !inThisRoom) goToPlay();
  }, [leaveRequested, wasInRoom, inThisRoom, goToPlay]);

  async function handleLeave(): Promise<void> {
    setLeaving(true);
    setLeaveRequested(true);
    joinPending.current = false;
    const result = await leave();
    if (result.ok) goToPlay();
    else {
      setLeaving(false);
      // Accusé perdu : le départ a peut-être eu lieu, on garde l'intention (un état sans nous mène à /play).
      // Tout autre échec (OFFLINE…) : rien n'est parti, une éviction ultérieure doit rester visible.
      if (result.error !== "TIMEOUT") setLeaveRequested(false);
    }
  }

  function handleConfigChange(patch: RoomConfigPatch): Promise<unknown> {
    return updateConfig(patch);
  }

  // Une erreur de `join` ne compte plus dès qu'on est dans la salle.
  const unavailable: ClientRoomErrorCode | null = !validCode
    ? "INVALID_CODE"
    : inThisRoom
      ? null
      : (joinError ??
        (wasInRoom && !leaveRequested && connection === "connected" ? "NOT_IN_ROOM" : null));

  return (
    <div className="flex flex-col gap-6">
      <ConnectionBanner status={connection} labels={labels.connection} />
      {unavailable ? (
        <RoomUnavailable code={unavailable} labels={labels} playHref={playHref} />
      ) : inThisRoom ? (
        <RoomView
          room={room}
          userId={userId}
          labels={labels}
          settingsLabels={settingsLabels}
          lang={locale}
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
