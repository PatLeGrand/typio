import type { ComponentPropsWithoutRef } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";
import { ButtonDecor } from "./ButtonDecor";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  /** Occupe toute la largeur du conteneur. */
  fullWidth?: boolean;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  type = "button",
  fullWidth = false,
  size = "default",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const decorated = variant !== "primary" && !props.disabled && props["aria-disabled"] !== true && props["aria-disabled"] !== "true";
  return (
    <button type={type} className={buttonClasses(variant, fullWidth, className, false, size)} {...props}>
      {decorated ? <ButtonDecor variant={variant} /> : null}
      {decorated ? <span className="button-label relative z-10 inline-flex min-w-0 items-center justify-center gap-2">{children}</span> : children}
    </button>
  );
}
