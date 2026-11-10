export type ButtonVariant = "primary" | "secondary" | "ghost" | "key";

// Les états désactivés utilisent des paires de tokens contrastées (testées dans
// src/theme/contrast.test.ts) plutôt qu'une simple baisse d'opacité.
const variantClasses: Record<ButtonVariant, string> = {
  // Hauteurs minimales (et non fixes) : un libellé long ou un texte agrandi
  // fait grandir le bouton au lieu d'être coupé.
  primary:
    "min-h-14 py-3 bg-accent text-base font-bold text-accent-foreground not-disabled:shadow-[0_4px_0_var(--accent-shadow)] not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_5px_0_var(--accent-shadow)] not-disabled:active:translate-y-[3px] not-disabled:active:shadow-[0_1px_0_var(--accent-shadow)] motion-reduce:not-disabled:hover:translate-y-0 motion-reduce:not-disabled:active:translate-y-0 disabled:bg-accent-panel disabled:text-muted-strong",
  key:
    "min-h-11 py-2 bg-key-yellow text-key-ink text-sm font-bold not-disabled:shadow-[0_4px_0_color-mix(in_oklab,var(--key-yellow),var(--key-ink)_35%)] not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_5px_0_color-mix(in_oklab,var(--key-yellow),var(--key-ink)_35%)] not-disabled:active:translate-y-[3px] not-disabled:active:shadow-[0_1px_0_color-mix(in_oklab,var(--key-yellow),var(--key-ink)_35%)] motion-reduce:not-disabled:hover:translate-y-0 motion-reduce:not-disabled:active:translate-y-0 disabled:bg-accent-panel disabled:text-muted-strong",
  secondary:
    "min-h-13 py-3 border border-border bg-surface text-sm font-semibold text-foreground not-disabled:hover:bg-accent-soft disabled:text-muted",
  ghost: "min-h-11 py-2 text-sm font-semibold text-accent-text not-disabled:hover:bg-accent-soft disabled:text-muted",
};

/**
 * Classes partagées par `Button` (élément `<button>`) et `ButtonLink` (lien de navigation
 * qui a l'apparence d'un bouton) : une seule source pour que les deux restent identiques.
 */
export function buttonClasses(variant: ButtonVariant, fullWidth: boolean, className: string, compactOnMobile = false): string {
  return `inline-flex items-center justify-center gap-2 rounded-field ${compactOnMobile ? "whitespace-nowrap px-4 md:px-6" : "px-6"} ${variant === "primary" || variant === "key" ? "transition-[transform,translate,box-shadow,background-color,color] duration-100 motion-reduce:transition-none" : "transition-colors"} disabled:cursor-not-allowed ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`;
}
