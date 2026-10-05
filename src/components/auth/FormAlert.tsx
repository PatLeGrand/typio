import { CircleAlert } from "lucide-react";

type FormAlertProps = {
  /** Message d'erreur général, déjà traduit. */
  children: string;
};

/** Erreur qui ne concerne aucun champ en particulier ; annoncée par les lecteurs d'écran. */
export function FormAlert({ children }: FormAlertProps) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-field border border-danger bg-surface px-4 py-3 text-sm font-semibold text-danger"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
