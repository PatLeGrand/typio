"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import type { ParticipantRole } from "@/realtime/protocol";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { roomPath } from "@/realtime/roomRoute";
import { useLoginRedirect } from "@/realtime/useLoginRedirect";
import { useRoom } from "@/realtime/useRoom";
import { ConnectionBanner } from "../../room/_components/ConnectionBanner";
import { RoomUnavailable } from "../../room/_components/RoomUnavailable";

type InviteClientProps = {
  /** Jeton de l'URL s'il a la bonne forme, sinon `null` (refusé sans appel au serveur). */
  token: string | null;
  role: ParticipantRole;
  locale: Locale;
  userId: string;
  labels: Dictionary["room"];
};

/** Utilise le lien (SALLE-04) une seule fois par montage, puis ouvre la salle. */
export function InviteClient({ token, role, locale, userId, labels }: InviteClientProps) {
  const router = useRouter();
  const { connection, joinInvite } = useRoom(userId);
  useLoginRedirect(connection, locale);
  const attempted = useRef(false);
  const [failure, setFailure] = useState<ClientRoomErrorCode | null>(token === null ? "INVITE_INVALID" : null);

  useEffect(() => {
    if (token === null || connection !== "connected" || attempted.current) return;
    attempted.current = true;
    void joinInvite(token, role).then((result) => {
      if (result.ok) router.replace(roomPath(locale, result.data.code, role));
      else setFailure(result.error);
    });
  }, [token, role, connection, joinInvite, router, locale]);

  return (
    <div className="flex flex-col gap-6">
      <ConnectionBanner status={connection} labels={labels.connection} />
      {failure ? (
        <RoomUnavailable code={failure} labels={labels} playHref={prefixWithLocale("/play", locale)} />
      ) : (
        <p className="text-muted-strong">{labels.invite.joining}</p>
      )}
    </div>
  );
}
