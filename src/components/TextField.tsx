import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "className"> & {
  /** Libellé visible, texte déjà traduit. */
  label: string;
  /**
   * Icône décorative à gauche du champ : passer un ÉLÉMENT déjà créé
   * (`icon={<Lock />}`), pas le composant (`icon={Lock}`). Un composant ne peut
   * pas traverser la frontière Server -> Client Component (PasswordField).
   * Le champ l'enveloppe dans un conteneur `aria-hidden` de 20 px, couleur `muted`.
   */
  icon?: ReactNode;
  /** Contenu à droite du champ (ex. bouton « afficher le mot de passe »). */
  endSlot?: ReactNode;
  /** Message d'erreur déjà traduit ; marque le champ comme invalide. */
  error?: string;
};

/** Libellé + champ de saisie natif. Aucune validation : l'appelant fournit `error`. */
export function TextField({
  label,
  icon,
  endSlot,
  error,
  id,
  type = "text",
  "aria-describedby": describedBy,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-[9px]">
      <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center text-muted [&>svg]:size-full"
          >
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds}
          className={`h-14 w-full rounded-field border bg-surface text-[15px] text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted ${
            error ? "border-danger" : "border-border"
          } ${icon ? "pl-12" : "pl-4"} ${endSlot ? "pr-14" : "pr-4"}`}
          {...props}
        />
        {endSlot ? <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">{endSlot}</div> : null}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
