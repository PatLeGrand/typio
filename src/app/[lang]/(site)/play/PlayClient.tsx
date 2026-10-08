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

type PlayClientProps = {
  locale: Locale;
  /** `users.id` de la session, lue côté serveur par la page. */
  userId: string;
  isGuest: boolean;
  labels: Dictionary["room"];
};

/**
 * Choix de la salle (SALLE-1, SALLE-4, SALLE-12). Si l'élève est déjà dans une salle (D7),
 * le bandeau propose d'y retourner ou de la quitter, et créer ou rejoindre est désactivé.
 */
export function PlayClient({ locale, userId, isGuest, labels }: PlayClientProps) {
  const router = useRouter();
  const { connection, room, error, create, leave, clearError } = useRoom(userId);
  useLoginRedirect(connection, locale);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleCreate(): Promise<void> {
    setBusy(true);
    const result = await create();
    if (result.ok) router.push(roomPath(locale, result.data.code));
    else setBusy(false);
  }

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
      {error ? <RoomError code={error} messages={labels.errors} /> : null}
      <div className="grid gap-6 md:grid-cols-2">
        <CreateRoomPanel
          labels={labels.play.create}
          isGuest={isGuest}
          disabled={inRoom || busy}
          onCreate={() => void handleCreate()}
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
