import { CircleCheck } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

type ChoiceRadioProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "className" | "children"> & {
  /** Libellé visible, texte déjà traduit. */
  label: string;
};

/**
 * Choix exclusif : un vrai `<input type="radio">` (flèches du clavier et lecteurs d'écran
 * natifs) caché visuellement, dont le libellé a l'apparence d'un bouton. Les radios d'un
 * même groupe partagent le même `name`.
 */
export function ChoiceRadio({ label, ...props }: ChoiceRadioProps) {
  return (
    <label className="group relative inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-field border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent-soft has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:text-muted">
      <input type="radio" className="sr-only" {...props} />
      <CircleCheck aria-hidden="true" className="hidden size-4 group-has-checked:block" />
      {label}
    </label>
  );
}
