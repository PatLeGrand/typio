export type ButtonVariant = "primary" | "secondary" | "ghost" | "key" | "start";
export type ButtonSize = "default" | "large";

// Les états désactivés utilisent des paires de tokens contrastées (testées dans
// src/theme/contrast.test.ts) plutôt qu'une simple baisse d'opacité.
const variantClasses: Record<ButtonVariant, string> = {
  // Hauteurs minimales (et non fixes) : un libellé long ou un texte agrandi
  // fait grandir le bouton au lieu d'être coupé.
  primary:
    "min-h-14 py-3 bg-accent text-base font-bold text-accent-foreground not-disabled:shadow-[0_4px_0_var(--accent-shadow)] not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_5px_0_var(--accent-shadow)] not-disabled:active:translate-y-[3px] not-disabled:active:shadow-[0_1px_0_var(--accent-shadow)] motion-reduce:not-disabled:hover:translate-y-0 motion-reduce:not-disabled:active:translate-y-0 disabled:bg-accent-panel disabled:text-muted-strong",
  key:
    "button-key bg-key-yellow text-key-ink font-bold not-disabled:shadow-[0_4px_0_var(--key-shadow)] not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_5px_0_var(--key-shadow)] not-disabled:active:translate-y-[3px] not-disabled:active:shadow-[0_1px_0_var(--key-shadow)] motion-reduce:not-disabled:hover:translate-y-0 motion-reduce:not-disabled:active:translate-y-0 disabled:bg-accent-panel disabled:text-muted-strong",
  start:
    "button-start min-h-14 min-w-0 max-w-full rounded-full border-2 border-border bg-surface py-3 text-base font-bold text-accent-text not-disabled:shadow-[0_6px_0_var(--accent-shadow)] not-disabled:hover:-translate-y-px not-disabled:hover:shadow-[0_8px_0_var(--accent-shadow)] not-disabled:focus-visible:-translate-y-px not-disabled:focus-visible:shadow-[0_8px_0_var(--accent-shadow)] not-disabled:active:translate-y-[4px] not-disabled:active:shadow-[0_1px_0_var(--accent-shadow)] motion-reduce:not-disabled:hover:translate-y-0 motion-reduce:not-disabled:focus-visible:translate-y-0 motion-reduce:not-disabled:active:translate-y-0 aria-disabled:focus-visible:shadow-none aria-disabled:focus-visible:translate-y-0 disabled:bg-accent-panel disabled:text-muted-strong aria-disabled:bg-accent-panel aria-disabled:text-muted-strong",
  secondary:
    "min-h-13 py-3 border border-border bg-surface text-sm font-semibold text-foreground not-disabled:hover:bg-accent-soft disabled:text-muted",
  ghost: "min-h-11 py-2 text-sm font-semibold text-accent-text not-disabled:hover:bg-accent-soft disabled:text-muted",
};

/**
 * Classes partagées par `Button` (élément `<button>`) et `ButtonLink` (lien de navigation
 * qui a l'apparence d'un bouton) : une seule source pour que les deux restent identiques.
 */
export function buttonClasses(variant: ButtonVariant, fullWidth: boolean, className: string, compactOnMobile = false, size: ButtonSize = "default"): string {
  return `relative isolate inline-flex items-center justify-center gap-2 ${variant === "start" ? "pl-[72px] pr-[84px]" : `rounded-field ${compactOnMobile ? "whitespace-nowrap px-4 md:px-6" : "px-6"}`} text-center ${variant === "primary" || variant === "key" || variant === "start" ? "transition-[transform,translate,box-shadow,background-color,color] duration-100 motion-reduce:transition-none after:absolute after:inset-[-4px_0_0] after:pointer-events-none after:content-[''] not-disabled:not-aria-disabled:active:after:pointer-events-auto aria-disabled:shadow-none aria-disabled:hover:shadow-none aria-disabled:active:shadow-none aria-disabled:translate-y-0 aria-disabled:hover:translate-y-0 aria-disabled:active:translate-y-0" : "button-outline transition-colors"} disabled:cursor-not-allowed ${variantClasses[variant]} ${variant === "key" ? size === "large" ? "min-h-14 py-3 text-base" : "min-h-11 py-2 text-sm" : ""} ${fullWidth ? "w-full" : ""} ${className}`;
}
