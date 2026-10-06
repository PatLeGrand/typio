export type ButtonVariant = "primary" | "secondary" | "ghost";

// Les états désactivés utilisent des paires de tokens contrastées (testées dans
// src/theme/contrast.test.ts) plutôt qu'une simple baisse d'opacité.
const variantClasses: Record<ButtonVariant, string> = {
  // Hauteurs minimales (et non fixes) : un libellé long ou un texte agrandi
  // fait grandir le bouton au lieu d'être coupé.
  primary:
    "min-h-14 py-3 bg-accent text-base font-bold text-accent-foreground not-disabled:hover:opacity-90 disabled:bg-accent-panel disabled:text-muted-strong",
  secondary:
    "min-h-13 py-3 border border-border bg-surface text-sm font-semibold text-foreground not-disabled:hover:bg-accent-soft disabled:text-muted",
  ghost: "min-h-11 py-2 text-sm font-semibold text-accent-text not-disabled:hover:bg-accent-soft disabled:text-muted",
};

/**
 * Classes partagées par `Button` (élément `<button>`) et `ButtonLink` (lien de navigation
 * qui a l'apparence d'un bouton) : une seule source pour que les deux restent identiques.
 */
export function buttonClasses(variant: ButtonVariant, fullWidth: boolean, className: string): string {
  return `inline-flex items-center justify-center gap-2 rounded-field px-6 transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`;
}
