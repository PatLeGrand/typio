import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";

type InviteFriendsUnavailableProps = {
  kind: "guest" | "anonymous";
  lang: Locale;
  labels: Dictionary["raceSettings"]["invite"];
};

/**
 * « Inviter des amis » désactivé pour un invité ou un visiteur non connecté (SALLE-12) : la raison est
 * affichée et reliée au bouton. Aucune connexion à la salle n'est ouverte.
 */
export function InviteFriendsUnavailable({ kind, lang, labels }: InviteFriendsUnavailableProps) {
  const reasonId = useId();

  return (
    <>
      <Button variant="secondary" fullWidth disabled aria-describedby={reasonId}>
        {labels.button}
      </Button>
      <p id={reasonId} className="text-sm text-muted-strong">
        {kind === "guest" ? labels.guestNotice : labels.anonymousNotice}
        {kind === "anonymous" ? (
          <>
            {" "}
            <Link href={prefixWithLocale("/login", lang)} className="font-semibold text-accent-text underline">
              {labels.loginLink}
            </Link>
          </>
        ) : null}
      </p>
    </>
  );
}
