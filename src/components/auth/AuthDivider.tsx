type AuthDividerProps = {
  /** Texte traduit au milieu du séparateur (« ou avec ton identifiant »). */
  children: string;
};

/** Filet horizontal interrompu par un court texte. Purement visuel : le texte reste lu. */
export function AuthDivider({ children }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
