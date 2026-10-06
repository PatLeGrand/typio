import type { ReactNode } from "react";
import type { OAuthProviderName } from "@/auth/oauth/providers";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Button } from "../Button";
import { buttonClasses } from "../buttonStyles";
import { DiscordIcon } from "../DiscordIcon";
import { GithubIcon } from "../GithubIcon";

type OAuthButtonsProps = {
  locale: Locale;
  labels: Dictionary["oauth"];
  /** Fournisseurs configurés sur le serveur (`getEnabledProviders()`) : leurs boutons sont actifs. */
  enabledProviders: readonly OAuthProviderName[];
};

// La mention « bientôt » est toujours sur sa propre ligne (`basis-full`), sous le nom du
// service, pour que les deux boutons restent alignés à toutes les largeurs.
const soonClasses = "basis-full text-center text-[11px] font-normal leading-none";

const PROVIDERS: { name: OAuthProviderName; icon: ReactNode }[] = [
  { name: "github", icon: <GithubIcon className="size-5" /> },
  { name: "discord", icon: <DiscordIcon className="size-5" /> },
];

/**
 * Connexion GitHub et Discord (AUTH-1 : en premier sur la page ; AUTH-2, AUTH-3). Un
 * fournisseur configuré est un lien vers la route de départ `/api/auth/{provider}` ; sinon le
 * bouton reste désactivé avec la mention « bientôt » (qui fait partie du nom accessible).
 *
 * Le lien est un `<a>` simple, pas un `next/link` : la route renvoie une redirection vers un autre
 * site et pose des cookies, ce que ni la navigation côté client ni le préchargement de
 * `Link` ne doivent déclencher. La ligne du dessous rappelle l'âge minimal (H-1).
 */
export function OAuthButtons({ locale, labels, enabledProviders }: OAuthButtonsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={labels.groupLabel} className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ name, icon }) =>
          enabledProviders.includes(name) ? (
            <a
              key={name}
              href={`/api/auth/${name}?locale=${locale}`}
              className={buttonClasses("secondary", false, "")}
            >
              {icon}
              <span>{labels[name]}</span>
            </a>
          ) : (
            <Button key={name} variant="secondary" disabled className="flex-wrap gap-y-1">
              {icon}
              <span>{labels[name]}</span>
              {/* Espace voulu : il sépare les mots du nom accessible sans rien afficher. */}
              {" "}
              <span className={soonClasses}>{labels.soon}</span>
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
