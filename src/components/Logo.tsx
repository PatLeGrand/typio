import { Keyboard } from "lucide-react";

type LogoProps = {
  /** Nom du produit affiché (texte du dictionnaire). */
  name: string;
  /** Signature affichée aprÃ¨s un séparateur vertical (texte traduit). */
  tagline?: string;
  className?: string;
};

/** Touche de clavier violette + nom du produit, avec signature optionnelle. */
export function Logo({ name, tagline, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <span className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground shadow-[0_4px_0_var(--accent-shadow)]">
        <Keyboard aria-hidden="true" className="size-[22px]" />
      </span>
      <span className="text-[27px] font-extrabold leading-none text-foreground">{name}</span>
      {tagline ? (
        <span className="hidden max-w-40 border-l border-border pl-3 text-xs leading-snug text-muted md:block">
          {tagline}
        </span>
      ) : null}
    </div>
  );
}
