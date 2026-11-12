"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { toSoloConfig } from "@/components/race/roomSettings";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { serializeRaceSettings, type RaceSettings } from "@/race/config";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { roomPath } from "@/realtime/roomRoute";
import { useLoginRedirect } from "@/realtime/useLoginRedirect";
import { useRoom } from "@/realtime/useRoom";
import { RoomError } from "../(site)/room/_components/RoomError";
import { ConnectionBanner } from "../(site)/room/_components/ConnectionBanner";

export function SoloRaceEntry({ locale, userId, settings, labels, roomLabels }: {
  locale: Locale;
  userId: string;
  settings: RaceSettings;
  labels: Dictionary["raceEntry"];
  roomLabels: Dictionary["room"];
}) {
  const router = useRouter();
  const { connection, startSolo } = useRoom(userId);
  useLoginRedirect(connection, locale);
  const started = useRef(false);
  const [error, setError] = useState<ClientRoomErrorCode | null>(null);

  useEffect(() => {
    if (connection !== "connected" || started.current) return;
    started.current = true;
    void startSolo(toSoloConfig(settings)).then((result) => {
      if (result.ok) router.replace(roomPath(locale, result.data.code));
      else setError(result.error);
    });
  }, [connection, startSolo, settings, router, locale]);

  return (
    <>
      <ConnectionBanner status={connection} labels={roomLabels.connection} />
      {error ? <RoomError code={error} messages={roomLabels.errors} /> : <p role="status">{labels.pending}</p>}
      {error || connection === "offline" || connection === "tooManyConnections" ? (
        <ButtonLink href={`/${locale}/race/settings?${serializeRaceSettings(settings)}`}>{labels.back}</ButtonLink>
      ) : null}
    </>
  );
}
