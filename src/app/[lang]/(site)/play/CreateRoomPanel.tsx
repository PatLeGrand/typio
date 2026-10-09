import { useId } from "react";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";

type CreateRoomPanelProps = {
  locale: Locale;
  labels: Dictionary["room"]["play"]["create"];
  /** Invité : création impossible, la raison est affichée (SALLE-12). */
  isGuest: boolean;
  /** Déjà dans une salle, ou une navigation est en cours. */
  disabled: boolean;
};

/**
 * « Créer une salle » (SALLE-1), réservé aux membres (SALLE-12) : mène aux paramètres de course, où la
 * salle est créée avec les réglages choisis (B-D4).
 */
export function CreateRoomPanel({ locale, labels, isGuest, disabled }: CreateRoomPanelProps) {
  const noticeId = useId();

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
      <p className="text-muted-strong">{labels.description}</p>
      {isGuest ? (
        <p id={noticeId} className="text-sm font-semibold text-danger">
          {labels.guestNotice}
        </p>
      ) : null}
      {isGuest || disabled ? (
        <Button disabled aria-describedby={isGuest ? noticeId : undefined}>
          {labels.button}
        </Button>
      ) : (
        <ButtonLink href={prefixWithLocale("/race/settings", locale)}>{labels.button}</ButtonLink>
      )}
    </Card>
  );
}
