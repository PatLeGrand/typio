"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ParticipantRole } from "@/realtime/protocol";
import { roomPath } from "@/realtime/roomRoute";
import { useLoginRedirect } from "@/realtime/useLoginRedirect";
import { useRoom } from "@/realtime/useRoom";
import { ConnectionBanner } from "../room/_components/ConnectionBanner";
import { RoomError } from "../room/_components/RoomError";
import { CreateRoomPanel } from "./CreateRoomPanel";
import { InRoomNotice } from "./InRoomNotice";
import { JoinRoomForm } from "./JoinRoomForm";
import { QuickJoinPanel } from "./QuickJoinPanel";
import { RoomExplorer } from "./RoomExplorer";

type PlayClientProps = {
  locale: Locale;
  /** `users.id` de la session, lue côté serveur par la page. */
  userId: string;
  isGuest: boolean;
  labels: Dictionary["room"];
};

/**
 * Choix de la salle (SALLE-01, SALLE-02, JOIN-01, AUTH-03). Si l'élève est déjà dans une salle (D7),
 * le bandeau propose d'y retourner ou de la quitter, et créer ou rejoindre est désactivé.
 */
export function PlayClient({ locale, userId, isGuest, labels }: PlayClientProps) {
  const router = useRouter();
  const { connection, room, error, kicked, lobby, leave, clearError, create, quickJoin, subscribeLobby, unsubscribeLobby } =
    useRoom(userId);
  useLoginRedirect(connection, locale);
  const [busy, setBusy] = useState(false);
  const [noRoom, setNoRoom] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  // Explorateur (JOIN-02) : abonné tant que la page est affichée.
  useEffect(() => {
    subscribeLobby();
    return unsubscribeLobby;
  }, [subscribeLobby, unsubscribeLobby]);

  // La navigation lancée par « Rejoindre » peut ne pas aboutir, ou la page être réaffichée telle
  // quelle (retour arrière, cache de page) : `busy` est alors remis à zéro, sinon créer et
  // rejoindre resteraient bloqués. Le démontage (cleanup) couvre aussi la page mise en veille.
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      reset();
    };
  }, []);

  async function handleLeave(): Promise<void> {
    setBusy(true);
    await leave();
    setBusy(false);
  }

  function handleJoin(code: string, role: ParticipantRole): void {
    // La navigation est lancée : plus de création ni de second « rejoindre » tant qu'elle dure.
    setBusy(true);
    router.push(roomPath(locale, code, role));
  }

  async function handleQuickJoin(): Promise<void> {
    setBusy(true);
    setNoRoom(false);
    const result = await quickJoin();
    if (result.ok) {
      // `busy` reste vrai : la navigation est lancée.
      router.push(roomPath(locale, result.data.code, "runner"));
      return;
    }
    if (result.error === "NO_ROOM_AVAILABLE") setNoRoom(true);
    setBusy(false);
  }

  // JOIN-03 : sans salle disponible, un membre crée une salle publique avec la configuration par défaut.
  async function handleCreatePublic(): Promise<void> {
    setBusy(true);
    const result = await create({ visibility: "public" }, "runner");
    if (result.ok) {
      router.push(roomPath(locale, result.data.code, "runner"));
      return;
    }
    setBusy(false);
  }

  const inRoom = room !== null;

  return (
    <div className="flex flex-col gap-6">
      <ConnectionBanner status={connection} labels={labels.connection} />
      {room ? (
        <InRoomNotice
          code={room.code}
          labels={labels.play.inRoom}
          roomHref={roomPath(locale, room.code)}
          leaving={busy}
          onLeave={() => void handleLeave()}
        />
      ) : null}
      {kicked ? <RoomError code="KICKED" messages={labels.errors} /> : null}
      {error && !(noRoom && error === "NO_ROOM_AVAILABLE") ? <RoomError code={error} messages={labels.errors} /> : null}
      <QuickJoinPanel
        labels={labels.play.quick}
        noRoomMessage={labels.errors.NO_ROOM_AVAILABLE}
        noRoom={noRoom}
        isGuest={isGuest}
        disabled={inRoom || busy}
        onQuickJoin={() => void handleQuickJoin()}
        onCreatePublic={() => void handleCreatePublic()}
      />
      <RoomExplorer
        locale={locale}
        labels={labels.play.explorer}
        rooms={lobby}
        disabled={inRoom || busy}
        onJoin={(code) => handleJoin(code, "runner")}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <CreateRoomPanel
          locale={locale}
          labels={labels.play.create}
          isGuest={isGuest}
          disabled={inRoom || busy}
        />
        <JoinRoomForm
          labels={labels.play.join}
          invalidCodeMessage={labels.errors.INVALID_CODE}
          disabled={inRoom || busy}
          onJoin={handleJoin}
        />
      </div>
    </div>
  );
}
