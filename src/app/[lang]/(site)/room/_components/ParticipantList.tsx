"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RoomState } from "@/realtime/protocol";

type ParticipantListProps = {
  room: RoomState;
  /** `users.id` de l'utilisateur courant, pour repérer « toi ». */
  currentUserId: string;
  raceLabels: Dictionary["raceScreen"];
  labels: Dictionary["room"]["participants"];
  /** Expulsion (SALLE-07) : fournie à l'hôte seulement ; sans elle, aucun bouton. */
  onKick?: (userId: string) => Promise<unknown>;
};

/**
 * Participants dans l'ordre d'arrivée ; la liste est une zone `aria-live` (SALLE-01, SALLE-05, COURSE-05).
 * L'hôte peut expulser chaque autre personne, après confirmation (SALLE-07).
 */
export function ParticipantList({ room, currentUserId, labels, raceLabels, onKick }: ParticipantListProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function kick(userId: string): Promise<void> {
    setPending(true);
    try {
      await onKick?.(userId);
    } finally {
      setPending(false);
      setConfirming(null);
    }
  }

  // SALLE-05 : la capacité compte les coureurs humains et les bots.
  const runners = room.participants.filter((participant) => participant.role === "runner").length + room.config.bots.length;

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="participants-title" className="text-lg font-bold text-foreground">
          {labels.title}
        </h2>
        <p className="text-sm text-muted-strong">
          {labels.runnersCount.replace("{count}", String(runners)).replace("{max}", String(room.config.capacity))}
        </p>
      </div>
      <ul aria-labelledby="participants-title" aria-live="polite" className="flex flex-col gap-2">
        {room.participants.map((participant) => (
          <li
            key={participant.userId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field border border-border px-4 py-3"
          >
            <Avatar name={participant.displayName} seed={participant.userId} userId={participant.userId} avatarVersion={participant.avatarVersion} size={32} />
            <span className="min-w-0 break-words font-semibold text-foreground">{participant.displayName}</span>
            {participant.kind === "guest" ? <Badge>{labels.guest}</Badge> : null}
            {participant.userId === room.hostId ? <Badge>{labels.host}</Badge> : null}
            {participant.userId === currentUserId ? <Badge tone="surface">{labels.you}</Badge> : null}
            <span className="text-sm text-muted-strong">
              {participant.role === "runner" ? labels.runner : labels.spectator}
            </span>
            {participant.connected ? null : (
              <span className="text-sm font-semibold text-danger">{labels.disconnected}</span>
            )}
            {onKick && participant.userId !== currentUserId ? (
              confirming === participant.userId ? (
                <div role="group" aria-label={labels.kickConfirm.replace("{name}", participant.displayName)} className="flex w-full flex-wrap items-center gap-3">
                  <p className="text-sm">{labels.kickConfirm.replace("{name}", participant.displayName)}</p>
                  <Button disabled={pending} onClick={() => void kick(participant.userId)}>{labels.kickYes}</Button>
                  <Button variant="secondary" onClick={() => setConfirming(null)}>{labels.kickCancel}</Button>
                </div>
              ) : (
                <Button variant="secondary" className="ml-auto" onClick={() => setConfirming(participant.userId)}>{labels.kick}</Button>
              )
            ) : null}
          </li>
        ))}
        {room.config.bots.map((level, index) => (
          <li key={`bot-${index}`} className="flex flex-wrap items-center gap-3 rounded-field border border-border px-4 py-3">
            {/* Le bot n'a pas encore de nom (tiré au départ) : avatar généré à partir de sa place. */}
            <Avatar name={raceLabels.bot} seed={`bot-${index}`} size={32} />
            <Badge>{raceLabels.bot}</Badge>
            <span>{raceLabels.botLevels[level]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
