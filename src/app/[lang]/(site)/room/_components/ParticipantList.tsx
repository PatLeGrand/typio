import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RoomState } from "@/realtime/protocol";

type ParticipantListProps = {
  room: RoomState;
  /** `users.id` de l'utilisateur courant, pour repérer « toi ». */
  currentUserId: string;
  labels: Dictionary["room"]["participants"];
};

/** Participants dans l'ordre d'arrivée ; la liste est une zone `aria-live` (SALLE-7). */
export function ParticipantList({ room, currentUserId, labels }: ParticipantListProps) {
  const runners = room.participants.filter((participant) => participant.role === "runner").length;

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="participants-title" className="text-lg font-bold text-foreground">
          {labels.title}
        </h2>
        <p className="text-sm text-muted-strong">
          {labels.runnersCount.replace("{count}", String(runners)).replace("{max}", String(room.maxRunners))}
        </p>
      </div>
      <ul aria-labelledby="participants-title" aria-live="polite" className="flex flex-col gap-2">
        {room.participants.map((participant) => (
          <li
            key={participant.userId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field border border-border px-4 py-3"
          >
            <span className="font-semibold text-foreground">{participant.displayName}</span>
            {participant.userId === room.hostId ? <Badge>{labels.host}</Badge> : null}
            {participant.userId === currentUserId ? <Badge tone="surface">{labels.you}</Badge> : null}
            <span className="text-sm text-muted-strong">
              {participant.role === "runner" ? labels.runner : labels.spectator}
            </span>
            {participant.connected ? null : (
              <span className="text-sm font-semibold text-danger">{labels.disconnected}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
