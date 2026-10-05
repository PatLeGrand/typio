import { CornerDownLeft } from "lucide-react";
import { Button } from "../Button";

type AuthSubmitButtonProps = {
  /** Libellé traduit, centré. */
  label: string;
  /** Texte traduit de la pastille de touche (« Entrée »). */
  enterKeyLabel: string;
  /** Envoi en cours : un second envoi est ignoré. */
  pending: boolean;
};

/**
 * Bouton principal des formulaires d'authentification : libellé centré et, à droite, une
 * pastille « Entrée » (rappel que la touche Entrée valide). La pastille est décorative : le
 * nom accessible reste le libellé.
 *
 * Pendant l'envoi, le bouton n'est PAS `disabled` : un bouton désactivé perd le focus, et
 * le clavier se retrouverait ailleurs dans la page. Il porte `aria-disabled` (même
 * apparence, annoncé par les lecteurs d'écran) et ignore les clics, ce qui annule aussi
 * l'envoi par la touche Entrée (le navigateur la traduit en clic sur ce bouton).
 */
export function AuthSubmitButton({ label, enterKeyLabel, pending }: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      fullWidth
      aria-disabled={pending ? true : undefined}
      aria-busy={pending ? true : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className="relative aria-disabled:cursor-not-allowed aria-disabled:bg-accent-panel aria-disabled:text-muted-strong aria-disabled:hover:opacity-100"
    >
      <span className="px-12">{label}</span>
      <span
        aria-hidden="true"
        className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg bg-accent-foreground/20 px-2 py-1.5 text-[11px] font-semibold leading-none"
      >
        <CornerDownLeft className="size-4" />
        <span className="hidden sm:inline">{enterKeyLabel}</span>
      </span>
    </Button>
  );
}
