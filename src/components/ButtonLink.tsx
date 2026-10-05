import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  /** Occupe toute la largeur du conteneur. */
  fullWidth?: boolean;
};

/**
 * Lien de navigation (`<a>`) qui a l'apparence d'un `Button`. À utiliser pour aller vers une
 * autre page : un `<button>` ne sait pas naviguer, et un lien dans un bouton est invalide.
 * Les icônes passent en enfants, comme pour `Button` (`<UserRound aria-hidden="true" />`).
 */
export function ButtonLink({ variant = "primary", fullWidth = false, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, fullWidth, "")} {...props} />;
}
