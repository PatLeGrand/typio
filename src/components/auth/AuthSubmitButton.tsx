import { CornerDownLeft } from "lucide-react";
import { Button } from "../Button";

type AuthSubmitButtonProps = {
  /** Libellé traduit, centré. */
  label: string;
  /** Texte traduit de la pastille de touche (« Entrée »). */
  enterKeyLabel: string;
  /** Envoi en cours : le bouton est désactivé pour éviter un double envoi. */
  pending: boolean;
};

/**
 * Bouton principal des formulaires d'authentification : libellé centré et, à droite, une
 * pastille « Entrée » (rappel que la touche Entrée valide). La pastille est décorative : le
 * nom accessible reste le libellé.
 */
export function AuthSubmitButton({ label, enterKeyLabel, pending }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" fullWidth disabled={pending} aria-busy={pending} className="relative">
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
