import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";
import { RoomError } from "./RoomError";

type RoomUnavailableProps = {
  code: ClientRoomErrorCode;
  labels: Dictionary["room"];
  /** Chemin de la page `/play` dans la langue courante. */
  playHref: string;
  headingLevel?: 1 | 2;
};

/** Salle introuvable, pleine, code invalide… : message traduit et retour au choix de salle. */
export function RoomUnavailable({ code, labels, playHref, headingLevel = 1 }: RoomUnavailableProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="flex flex-col items-start gap-6">
      <Heading className="text-3xl font-bold text-balance">{labels.unavailableTitle}</Heading>
      <RoomError code={code} messages={labels.errors} />
      <ButtonLink href={playHref} variant="secondary">
        {labels.back}
      </ButtonLink>
    </div>
  );
}
