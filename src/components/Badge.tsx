import type { ComponentPropsWithoutRef, ReactNode } from "react";

type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "className"> & {
  /**
   * Icône décorative avant le texte : passer un ÉLÉMENT déjà créé
   * (`icon={<Sparkles />}`), pas le composant (`icon={Sparkles}`). Un composant
   * ne peut pas traverser la frontière Server -> Client Component.
   * Le badge l'enveloppe dans un conteneur `aria-hidden` de 14 px.
   */
  icon?: ReactNode;
};

/** Pastille de texte court en majuscules. */
export function Badge({ icon, children, ...props }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-accent-text"
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex size-3.5 shrink-0 items-center justify-center [&>svg]:size-full">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
