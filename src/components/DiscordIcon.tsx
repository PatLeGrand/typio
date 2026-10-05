import type { ComponentPropsWithoutRef } from "react";
import { siDiscord } from "simple-icons";

type DiscordIconProps = Omit<ComponentPropsWithoutRef<"svg">, "children" | "viewBox" | "fill">;

/**
 * Logo Discord (Simple Icons, domaine public), monochrome : il prend la couleur du texte
 * (`currentColor`), comme l'exigent les usages de marque. Même taille que `GithubIcon`
 * (20 px), décoratif par défaut.
 */
export function DiscordIcon({ "aria-hidden": ariaHidden = true, ...props }: DiscordIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={ariaHidden}
      {...props}
    >
      <path d={siDiscord.path} />
    </svg>
  );
}
