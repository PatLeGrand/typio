import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "className" | "children"> & {
  /** Libellé cliquable, texte déjà traduit. */
  label: ReactNode;
};

/** Case à cocher native (couleur d'accent du thème) avec libellé cliquable. */
export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted">
      <input type="checkbox" className="size-[18px] shrink-0 cursor-[inherit] accent-accent" {...props} />
      {label}
    </label>
  );
}
