import type { CodexEvents, Effort, SandboxMode } from "./codex";
import type { Changes } from "./collect";

/** Pied et rapport affichés sur stdout. Fonctions pures, testées dans `report.test.ts`. */

export type FooterOptions = {
  model: string;
  effort: Effort;
  sandbox: SandboxMode;
  /** Raison donnée à `--sortie-bac-a-sable`, si le bac à sable est levé. */
  sandboxExitReason?: string;
  usage: CodexEvents["usage"];
  seconds: number;
  /** Fichiers que la copie de lecture n'a pas pu recopier (sensibles, liens hors du dépôt). */
  skippedFiles?: number;
};

const SANDBOX_LABELS: Record<SandboxMode, string> = {
  "read-only": "lecture seule",
  "workspace-write": "workspace-write, réseau coupé",
  "danger-full-access": "SORTIE DU BAC À SABLE (danger-full-access)",
};

/** Ligne de pied : modèle, effort, bac à sable (et sa raison), jetons, durée. */
export function formatFooter({ model, effort, sandbox, sandboxExitReason, usage, seconds, skippedFiles }: FooterOptions): string {
  const reason = sandboxExitReason ? ` : ${sandboxExitReason}` : "";
  const tokens = usage ? ` · ${usage.input + usage.output} tokens` : "";
  const skipped = skippedFiles ? ` · ${skippedFiles} fichier(s) écarté(s) de la copie` : "";
  return `Codex ${model}/${effort} · bac à sable ${SANDBOX_LABELS[sandbox]}${reason}${tokens}${skipped} · ${seconds} s`;
}

/** Bandeau répété en tête et en pied du rapport quand le bac à sable est levé. */
export function sandboxExitBanner(reason: string): string {
  return `ATTENTION : bac à sable levé (danger-full-access) — raison : ${reason}. Canari d'écriture sauté.`;
}

export type WriteReport = {
  lastMessage: string;
  /** Section déjà formatée par `formatChecks`. */
  checks: string;
  /** `git status --porcelain` du worktree. */
  status: string;
  /** `git diff --stat` du worktree, suivi des fichiers nouveaux (voir `summarizeAdded`). */
  diffStat: string;
  worktreePath: string;
  branch: string;
  footer: string;
  sandboxExitReason?: string;
  /** Fichiers ignorés par le `.gitignore` créés par Codex hors de `node_modules/` et `.next/` : non reportés. */
  ignored?: readonly string[];
  /** Fichiers à relire en premier (voir `priorityReviewFiles`). */
  priority?: readonly string[];
  /** Les canaris ont été invalidés (bac à sable levé) : les prochains seront relancés. */
  canariesReset?: boolean;
};

const MAX_IGNORED_LINES = 30;

// Fichiers qui changent ce que git, bun, npm ou la CI font du dépôt : un diff qui les touche se relit d'abord.
const PRIORITY_NAMES = new Set([".gitattributes", ".gitignore", ".lfsconfig", "bunfig.toml", ".npmrc", "bun.lock", "package.json"]);

/**
 * Fichiers ajoutés, modifiés ou supprimés dont le nom (à toute profondeur) est `.gitattributes`, `.gitignore`,
 * `.lfsconfig`, `bunfig.toml`, `.npmrc`, `bun.lock` ou `package.json`, ou qui sont sous `.github/`.
 */
export function priorityReviewFiles(changes: Pick<Changes, "added" | "modified" | "deleted">): string[] {
  const all = [...changes.added.map((f) => ["ajouté", f]), ...changes.modified.map((f) => ["modifié", f]), ...changes.deleted.map((f) => ["supprimé", f])];
  return all
    .filter(([, file]) => PRIORITY_NAMES.has(file?.slice(file.lastIndexOf("/") + 1) ?? "") || file?.startsWith(".github/"))
    .map(([kind, file]) => `${file} (${kind})`)
    .sort();
}

/** Bloc en tête du rapport : ce qui configure git, bun, npm ou la CI. */
export function formatPriority(priority: readonly string[]): string | null {
  if (priority.length === 0) return null;
  return `A RELIRE EN PRIORITÉ :\n${priority.map((line) => `- ${line}`).join("\n")}`;
}

const CANARIES_RESET_NOTE = "NOTE : bac à sable levé, les caches des canaris (state/canary-*.json) ont été supprimés : les prochaines tâches relanceront les canaris.";

/** Section « fichiers ignorés » : au plus 30 lignes, pour que l'orchestrateur voie ce qui n'a pas été reporté. */
export function formatIgnored(ignored: readonly string[]): string | null {
  if (ignored.length === 0) return null;
  const shown = ignored.slice(0, MAX_IGNORED_LINES);
  const more = ignored.length > shown.length ? `\n… (+${ignored.length - shown.length} autres)` : "";
  return `## Fichiers ignorés créés par Codex (non reportés)\n\n\`\`\`\n${shown.join("\n")}${more}\n\`\`\``;
}

export function buildWriteReport(report: WriteReport): string {
  const banner = report.sandboxExitReason ? sandboxExitBanner(report.sandboxExitReason) : null;
  const ignored = formatIgnored(report.ignored ?? []);
  const priority = formatPriority(report.priority ?? []);
  const sections = [
    ...(banner ? [banner] : []),
    ...(priority ? [priority] : []),
    report.lastMessage,
    `## Vérifications (lancées par le wrapper)\n\n${report.checks}`,
    `## Modifications du worktree\n\n\`\`\`\n${report.status.trimEnd() || "(aucun changement)"}\n\`\`\`\n\n\`\`\`\n${report.diffStat.trimEnd() || "(aucun diff)"}\n\`\`\``,
    ...(ignored ? [ignored] : []),
    `## Worktree\n\nChemin : ${report.worktreePath}\nBranche : ${report.branch}\nNettoyage : bun scripts/codex/run.ts clean ${report.branch}`,
    ...(report.canariesReset ? [CANARIES_RESET_NOTE] : []),
    `---\n${report.footer}${banner ? `\n${banner}` : ""}`,
  ];
  return sections.join("\n\n");
}

export type NoChangeReport = {
  lastMessage: string;
  /** Section déjà formatée (`formatSandboxChecks` ou un texte fixe). */
  checks: string;
  footer: string;
  sandboxExitReason?: string;
  ignored?: readonly string[];
  canariesReset?: boolean;
};

/** Rapport quand Codex n'a rien changé : ni worktree ni branche, le dossier `work` est supprimé. */
export function buildNoChangeReport(report: NoChangeReport): string {
  const banner = report.sandboxExitReason ? sandboxExitBanner(report.sandboxExitReason) : null;
  const ignored = formatIgnored(report.ignored ?? []);
  const sections = [
    ...(banner ? [banner] : []),
    report.lastMessage,
    `## Vérifications (lancées par le wrapper)\n\n${report.checks}`,
    "## Modifications\n\nAucun changement : Codex n'a modifié ni ajouté aucun fichier à reporter. Aucun worktree ni aucune branche n'a été créé.",
    ...(ignored ? [ignored] : []),
    ...(report.canariesReset ? [CANARIES_RESET_NOTE] : []),
    `---\n${report.footer}${banner ? `\n${banner}` : ""}`,
  ];
  return sections.join("\n\n");
}
