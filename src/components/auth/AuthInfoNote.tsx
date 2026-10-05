import { Info } from "lucide-react";

type AuthInfoNoteProps = {
  /** Texte traduit de l'encart. */
  children: string;
};

/** Encart d'information discret, avec une icône décorative. */
export function AuthInfoNote({ children }: AuthInfoNoteProps) {
  return (
    <p className="flex items-start gap-2 rounded-[10px] bg-accent-soft px-4 py-3 text-[13px] leading-snug text-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-text" />
      {children}
    </p>
  );
}
