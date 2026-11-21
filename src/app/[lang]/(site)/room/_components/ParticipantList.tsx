"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BlobPreview } from "@/components/race/BlobPreview";
import type { Dictionary } from "@/i18n/dictionaries";
import { BLOB_COLORS, DEFAULT_BLOB_STYLE, type BlobStyle } from "@/race/blobStyle";
import type { RoomState } from "@/realtime/protocol";
import { RoomBlobModal } from "./RoomBlobModal";

type ParticipantListProps = {
  room: RoomState;
  /** `users.id` de l'utilisateur courant, pour repérer « toi ». */
  currentUserId: string;
  raceLabels: Dictionary["raceScreen"];
  labels: Dictionary["room"]["participants"];
  /** Textes de personnalisation du blob : active le bouton et la popup sur la carte du joueur courant. */
  blobLabels?: Dictionary["profile"]["blob"];
  /** Appelé après l'enregistrement d'un nouveau style de blob pour synchroniser la salle. */
  onBlobSaved?: (style: BlobStyle) => void;
  /** Expulsion (SALLE-07) : fournie à l'hôte seulement ; sans elle, aucun bouton. */
  onKick?: (userId: string) => Promise<unknown>;
};

/**
 * Participants dans l'ordre d'arrivée ; la liste est une zone `aria-live` (SALLE-01, SALLE-05, COURSE-05).
 * L'hôte peut expulser chaque autre personne, après confirmation (SALLE-07).
 */
export function ParticipantList({
  room,
  currentUserId,
  labels,
  raceLabels,
  blobLabels,
  onBlobSaved,
  onKick,
}: ParticipantListProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [blobModalOpen, setBlobModalOpen] = useState(false);

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
  const currentParticipant = room.participants.find((participant) => participant.userId === currentUserId);

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
      <ul aria-labelledby="participants-title" aria-live="polite" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {room.participants.map((participant) => {
          const isCurrentUser = participant.userId === currentUserId;
          const canCustomizeBlob = isCurrentUser && Boolean(blobLabels);

          return (
            <li
              key={participant.userId}
              className={`flex min-w-0 flex-col items-center gap-2 rounded-field border p-4 text-center ${
                canCustomizeBlob ? "border-accent bg-accent-soft/40" : "border-border"
              }`}
            >
              {canCustomizeBlob ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={labels.customizeBlobHint}
                  onClick={() => setBlobModalOpen(true)}
                  title={labels.customizeBlobHint}
                  className="room-blob-attention group relative flex cursor-pointer items-center justify-center rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden="true"
                    className="room-blob-halo pointer-events-none absolute inset-0 rounded-full bg-key-yellow/55 ring-2 ring-accent/50"
                  />
                  <BlobPreview
                    style={participant.blobStyle ?? DEFAULT_BLOB_STYLE}
                    size={56}
                    className={participant.connected ? "relative z-10 shrink-0" : "relative z-10 shrink-0 opacity-60"}
                  />
                  <span
                    aria-hidden="true"
                    className="room-blob-sparkle absolute -top-1 -right-1 z-20 flex size-6 items-center justify-center rounded-full border border-key-ink bg-key-yellow text-key-ink shadow-soft"
                  >
                    <Sparkles className="size-3.5" />
                  </span>
                </button>
              ) : (
                <BlobPreview
                  style={participant.blobStyle ?? DEFAULT_BLOB_STYLE}
                  size={56}
                  className={participant.connected ? "shrink-0" : "shrink-0 opacity-60"}
                />
              )}
              <span className="max-w-full break-words font-semibold text-foreground">{participant.displayName}</span>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {participant.kind === "guest" ? <Badge>{labels.guest}</Badge> : null}
                {participant.userId === room.hostId ? <Badge>{labels.host}</Badge> : null}
                {isCurrentUser ? <Badge tone="surface">{labels.you}</Badge> : null}
                <span className="text-sm text-muted-strong">
                  {participant.role === "runner" ? labels.runner : labels.spectator}
                </span>
              </div>
              {participant.connected ? null : (
                <span className="text-sm font-semibold text-danger">{labels.disconnected}</span>
              )}
              {canCustomizeBlob ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  title={labels.customizeBlobHint}
                  onClick={() => setBlobModalOpen(true)}
                  className="mt-auto inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-field border-2 border-key-ink bg-key-yellow px-2.5 py-1.5 text-xs font-extrabold text-key-ink shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Sparkles aria-hidden="true" className="room-blob-sparkle size-3.5 shrink-0" />
                  <span className="truncate">{labels.customizeBlob}</span>
                </button>
              ) : null}
              {onKick && !isCurrentUser ? (
                confirming === participant.userId ? (
                  <div
                    role="group"
                    aria-label={labels.kickConfirm.replace("{name}", participant.displayName)}
                    className="mt-auto flex w-full flex-col items-center gap-2 pt-1"
                  >
                    <p className="max-w-full break-words text-sm text-foreground">
                      {labels.kickConfirm.replace("{name}", participant.displayName)}
                    </p>
                    <div className="flex w-full flex-wrap justify-center gap-2">
                      <Button
                        disabled={pending}
                        className="min-h-10 w-full max-w-full px-3 py-2 text-sm"
                        onClick={() => void kick(participant.userId)}
                      >
                        {labels.kickYes}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        className="min-h-10 w-full max-w-full px-3 py-2 text-sm"
                        onClick={() => setConfirming(null)}
                      >
                        {labels.kickCancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="mt-auto min-h-10 w-full max-w-full px-3 py-2 text-sm"
                    onClick={() => setConfirming(participant.userId)}
                  >
                    {labels.kick}
                  </Button>
                )
              ) : null}
            </li>
          );
        })}
        {room.config.bots.map((level, index) => (
          <li
            key={`bot-${index}`}
            className="flex min-w-0 flex-col items-center gap-2 rounded-field border border-border p-4 text-center"
          >
            {/* Le bot n'a pas encore de nom (tiré au départ) : blob coloré selon sa place. */}
            <BlobPreview
              style={{
                ...DEFAULT_BLOB_STYLE,
                color: BLOB_COLORS[(index + 1) % BLOB_COLORS.length],
              }}
              size={56}
              className="shrink-0"
            />
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Badge>{raceLabels.bot}</Badge>
              <span className="text-sm text-muted-strong">{raceLabels.botLevels[level]}</span>
            </div>
          </li>
        ))}
      </ul>
      {blobLabels ? (
        <RoomBlobModal
          open={blobModalOpen}
          initialStyle={currentParticipant?.blobStyle ?? DEFAULT_BLOB_STYLE}
          closeLabel={labels.closeBlobModal}
          hintLabel={labels.customizeBlobHint}
          blobLabels={blobLabels}
          onClose={() => setBlobModalOpen(false)}
          onSaved={onBlobSaved}
        />
      ) : null}
    </Card>
  );
}
