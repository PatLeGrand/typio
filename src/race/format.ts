/** Mise en forme des valeurs de la course (A-D9) : aucun texte en dur, les modèles viennent du dictionnaire. */
export type OrdinalTemplates = Readonly<Record<"one" | "two" | "few" | "other", string>>;

export type PluralTemplates = Readonly<Record<"one" | "other", string>>;

/** Modèle singulier ou pluriel selon la catégorie cardinale de la langue (« 1 caractère », « 2 caractères »). */
export function formatPlural(locale: string, count: number, templates: PluralTemplates): string {
  return new Intl.PluralRules(locale).select(count) === "one" ? templates.one : templates.other;
}

/** « 1er », « 2e » / « 1st », « 2nd »… : la catégorie plurielle ordinale de la langue choisit le modèle. */
export function formatOrdinal(locale: string, rank: number, templates: OrdinalTemplates): string {
  const category = new Intl.PluralRules(locale, { type: "ordinal" }).select(rank);
  const template = category === "one" || category === "two" || category === "few" ? templates[category] : templates.other;
  return template.replace("{rank}", String(rank));
}

/** mm:ss, les secondes entamées comptant pour le temps restant (`round: "ceil"`). */
export function formatClock(ms: number, round: "floor" | "ceil" = "floor"): string {
  const seconds = Math.max(0, round === "ceil" ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** mm:ss.d pour un temps de résultat (le dixième départage les arrivées proches). */
export function formatDuration(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  return `${formatClock(tenths * 100)}.${tenths % 10}`;
}
