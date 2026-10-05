import type { ComponentPropsWithoutRef } from "react";

/** Surface arrondie à ombre douce. Le remplissage (padding) est laissé à l'appelant. */
export function Card({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`rounded-card bg-surface shadow-soft ${className}`} {...props} />;
}
