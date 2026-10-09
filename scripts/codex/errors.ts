/** Erreurs distinguées par `run.ts` pour choisir le code de sortie. */

/** Mauvaise utilisation : tâche inconnue, option invalide, aucun changement à relire… (code 1). */
export class UsageError extends Error {}

/** Codex inutilisable : on continue sans lui (code 2). */
export class UnavailableError extends Error {}

/**
 * Le travail de Codex (`work/<id>/src`) contient quelque chose que le wrapper refuse de reporter :
 * un dépôt git imbriqué, un `.gitmodules`, un lien, un fichier secret nouveau, un `.codex/`
 * (code 2, libellé `ALERTE`). Le dossier `work` est gardé comme preuve et aucun git n'y est lancé.
 */
export class TamperedWorkError extends UnavailableError {}

/**
 * Code de sortie et message pour une erreur arrivée jusqu'à `run.ts`. Une alerte de sécurité
 * (écriture hors du dossier de travail) garde son libellé `ALERTE`, sans préfixe.
 */
export function describeExit(error: unknown): { code: 1 | 2; message: string } {
  if (error instanceof UsageError) return { code: 1, message: error.message };
  const message = error instanceof Error ? error.message : String(error);
  // Échec de préparation (copie, git…) compris : on se rabat aussi sur Claude.
  return { code: 2, message: message.startsWith("ALERTE") ? message : `CODEX_INDISPONIBLE : ${message}` };
}
