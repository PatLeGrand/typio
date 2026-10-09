import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";

type InRoomNoticeProps = {
  code: string;
  labels: Dictionary["room"]["play"]["inRoom"];
  /** Chemin de la salle, dans la langue courante. */
  roomHref: string;
  leaving: boolean;
  onLeave: () => void;
};

/** L'élève est déjà dans une salle (D7) : y retourner ou la quitter avant d'en choisir une autre. */
export function InRoomNotice({ code, labels, roomHref, leaving, onLeave }: InRoomNoticeProps) {
  return (
    <Card className="flex flex-col gap-4 border border-accent-text p-6">
      <p className="text-lg font-bold text-foreground">{labels.message.replace("{code}", code)}</p>
      <p className="text-sm text-muted-strong">{labels.disabledNote}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={roomHref}>{labels.return}</ButtonLink>
        <Button variant="secondary" onClick={onLeave} disabled={leaving}>
          {labels.leave}
        </Button>
      </div>
    </Card>
  );
}
