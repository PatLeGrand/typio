import type { Dictionary } from "@/i18n/dictionaries";
import { Button } from "../Button";
import { GithubIcon } from "../GithubIcon";

type OAuthButtonsProps = {
  labels: Dictionary["oauth"];
};

// La mention « bientôt » est toujours sur sa propre ligne (`basis-full`), sous le nom du
// service, pour que les deux boutons restent alignés à toutes les largeurs.
const soonClasses = "basis-full text-center text-[11px] font-normal leading-none";

/**
 * Connexion GitHub et Discord (AUTH-1 : en premier sur la page). AUTH-2 et AUTH-3 ne sont pas
 * encore implémentées : les boutons sont désactivés et la mention « bientôt » reste visible
 * (et fait partie du nom accessible).
 */
export function OAuthButtons({ labels }: OAuthButtonsProps) {
  return (
    <div role="group" aria-label={labels.groupLabel} className="grid grid-cols-2 gap-3">
      <Button variant="secondary" disabled className="flex-wrap gap-y-1">
        <GithubIcon className="size-5" />
        <span>{labels.github}</span>
        {/* Espace voulu : il sépare les mots du nom accessible sans rien afficher. */}
        {" "}
        <span className={soonClasses}>{labels.soon}</span>
      </Button>
      <Button variant="secondary" disabled className="flex-wrap gap-y-1">
        <span>{labels.discord}</span>
        {" "}
        <span className={soonClasses}>{labels.soon}</span>
      </Button>
    </div>
  );
}
