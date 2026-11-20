type AuthHeadingProps = {
  /** Surtitre traduit (affiché en majuscules). */
  kicker: string;
  /** Titre de la page : c'est le `h1`. */
  title: string;
  intro?: string;
};

/** Surtitre sobre souligné d'une touche de tartan, titre en Big Shoulders et introduction éventuelle. */
export function AuthHeading({ kicker, title, intro }: AuthHeadingProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        <span aria-hidden="true" className="h-0.5 w-6 bg-track" />
        {kicker}
      </p>
      <h1 className="text-balance font-display text-[clamp(2.35rem,9vw,3.35rem)] font-black leading-[0.92] tracking-[-0.01em] text-foreground">
        {title}
      </h1>
      {intro && <p className="max-w-[42ch] text-pretty text-[15px] leading-relaxed text-muted">{intro}</p>}
    </div>
  );
}
