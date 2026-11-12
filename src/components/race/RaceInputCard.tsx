import type { ComponentPropsWithoutRef } from "react";

/** Surface de saisie partagée entre l'essai de l'accueil et la course. */
export function RaceInputCard({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5 md:min-h-[204px] ${className}`} {...props} />;
}
