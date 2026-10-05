import type { ComponentPropsWithoutRef } from "react";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  /** Occupe toute la largeur du conteneur. */
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  type = "button",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, fullWidth, className)} {...props} />;
}
