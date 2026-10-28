"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { toRoomConfig } from "@/components/race/roomSettings";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import type { ParticipantRole } from "@/realtime/protocol";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { roomPath } from "@/realtime/roomRoute";
import { useRoom } from "@/realtime/useRoom";
import { RoomError } from "../../room/_components/RoomError";

type InviteFriendsButtonProps = {
  lang: Locale;
  /** `users.id` de la session (membre) : monté seulement pour un membre, car il ouvre la connexion à la salle. */
  userId: string;
  settings: RaceSettings;
  /** Contrôle les réglages avant l'envoi ; faux = rien n'est envoyé. */
  validate: () => boolean;
  labels: Dictionary["raceSettings"]["invite"];
  errorMessages: Dictionary["room"]["errors"];
};

/** « Inviter des amis » (SALLE-01, B-D4) : crée une salle avec les réglages choisis puis l'ouvre. */
export function InviteFriendsButton({ lang, userId, settings, validate, labels, errorMessages }: InviteFriendsButtonProps) {
  const router = useRouter();
  const { create } = useRoom(userId);
  const [role, setRole] = useState<ParticipantRole>("runner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientRoomErrorCode | null>(null);

  // Retour arrière après la création : la page réaffichée depuis le cache garderait le bouton bloqué.
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  async function handleInvite(): Promise<void> {
    if (!validate()) return;
    setBusy(true);
    setError(null);
    const result = await create(toRoomConfig(settings), role);
    if (result.ok) {
      // `busy` reste vrai : la navigation est lancée, pas de seconde création.
      router.push(roomPath(lang, result.data.code, role));
      return;
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <>
      <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">{labels.roleLabel}</legend>
        {(["runner", "spectator"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-foreground">
            <input
              type="radio"
              name="hostRole"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
              className="size-4 accent-accent"
            />
            {labels[value]}
          </label>
        ))}
      </fieldset>
      <Button variant="secondary" fullWidth disabled={busy} onClick={() => void handleInvite()}>
        {labels.button}
      </Button>
      {error ? <RoomError code={error} messages={errorMessages} /> : null}
    </>
  );
}
