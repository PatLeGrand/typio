import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";
import { ButtonDecor } from "./ButtonDecor";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  /** Occupe toute la largeur du conteneur. */
  fullWidth?: boolean;
  /** Réduit les marges des liens courts de l’en-tête sous 768 px. */
  compactOnMobile?: boolean;
  size?: ButtonSize;
};

/**
 * Lien de navigation (`<a>`) qui a l'apparence d'un `Button`. À utiliser pour aller vers une
 * autre page : un `<button>` ne sait pas naviguer, et un lien dans un bouton est invalide.
 * Les icônes passent en enfants, comme pour `Button` (`<UserRound aria-hidden="true" />`).
 */
export function ButtonLink({ variant = "primary", fullWidth = false, compactOnMobile = false, size = "default", className = "", children, ...props }: ButtonLinkProps) {
  const decorated = variant === "start" || (variant !== "primary" && props["aria-disabled"] !== true && props["aria-disabled"] !== "true");
  return (
    <Link className={buttonClasses(variant, fullWidth, className, compactOnMobile, size)} {...props}>
      {decorated ? <ButtonDecor variant={variant} /> : null}
      {decorated ? <span className="button-label relative z-10 inline-flex min-w-0 items-center justify-center gap-2">{children}</span> : children}
    </Link>
  );
}
