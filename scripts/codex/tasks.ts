import type { Effort } from "./codex";
import { UsageError } from "./errors";

/**
 * Tâches confiées à Codex. Les tâches de lecture (`search`, `review`, `tests`, `ui`) lisent la
 * copie expurgée du dépôt (et `CODEX_CONTEXT.md` pour un diff) puis rendent un texte court. Les
 * tâches d'écriture (`implement`, `qa`) travaillent dans une copie dédiée sans git, sur un brief.
 */

/** Modèle, effort et délai d'une tâche. Surchargeables avec `--model` et `--effort`. */
export type Profile = {
  model: string;
  /** Effort de raisonnement : `low` pour chercher, `medium` pour juger et écrire. */
  effort: Effort;
  timeoutMinutes: number;
};

export type TaskName = "search" | "review" | "tests" | "ui";

export type ContextKind = "files" | "diff";

export type Task = Profile & {
  context: ContextKind;
  /** Vrai si la tâche n'a pas de sens sans consigne (une question, par exemple). */
  requiresInstruction: boolean;
  instructions: string;
};

/** Nom du fichier de contexte écrit à la racine de la copie pour les tâches à diff. */
export const CONTEXT_FILE = "CODEX_CONTEXT.md";

const FINDINGS_FORMAT = `Format : une liste de constats, du plus grave au moins grave, au plus 15.
Chaque constat : priorité (P0 à P3, définies dans .agents/skills/code-review/SKILL.md), \`chemin:ligne\`,
le problème en une phrase, le scénario concret qui le déclenche, la correction suggérée en une phrase.
Ne signale que ce que le code justifie. Pas de compliments, pas de remarques de style.
Si tu ne trouves rien, réponds exactement « Aucun constat. ».`;

export const TASKS: Record<TaskName, Task> = {
  search: {
    model: "gpt-6-luna",
    effort: "low",
    timeoutMinutes: 4,
    context: "files",
    requiresInstruction: true,
    instructions: `Tâche : répondre à une question sur le dépôt (localiser du code, lire une doc, expliquer comment X est fait).
Explore avec des commandes de lecture : \`rg\` s'il est disponible, sinon Get-ChildItem, Select-String et Get-Content.
Ce Next.js diffère de tes connaissances : pour toute question sur le framework, appuie-toi sur node_modules/next/dist/docs/.
Les exigences sont dans docs/cahier-des-charges.md (identifiants comme SALLE-4 ou H-9) : cite l'identifiant quand il s'applique.
Format : références \`chemin:ligne\` puis une conclusion de 3 à 10 lignes. Pas de recopie de fichiers.
Si la réponse n'est ni dans le code ni dans la doc, dis-le au lieu de deviner.`,
  },
  review: {
    model: "gpt-5.6-terra",
    effort: "medium",
    timeoutMinutes: 8,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : relire le diff de ${CONTEXT_FILE} et y trouver bugs, régressions, tests manquants et violations des règles.
Lis d'abord CLAUDE.md, .agents/skills/code-review/SKILL.md et .agents/skills/code-quality/SKILL.md.
Ouvre les fichiers modifiés en entier quand le diff ne suffit pas à juger.
Signale aussi si le changement touche à l'authentification, aux sessions, aux cookies, à OAuth, à la confiance WebSocket ou à l'anti-triche : il lui faut une revue de sécurité.
${FINDINGS_FORMAT}`,
  },
  tests: {
    model: "gpt-5.6-terra",
    effort: "medium",
    timeoutMinutes: 8,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : concevoir les tests du changement décrit par le diff de ${CONTEXT_FILE}, sans les écrire.
Lis .agents/skills/qa/SKILL.md, les exigences citées dans docs/cahier-des-charges.md et les tests existants voisins des fichiers modifiés.
Rends deux sections :
1. « Cas de test proposés » : cas nominaux, limites, erreurs et scénarios d'acceptation. Pour chacun : fichier de test cible, nom du test, ce qu'il vérifie, exigence ou critère AC concerné. Au plus 20, les plus utiles d'abord.
2. « Trous de couverture » : fonctions, branches ou comportements modifiés qu'aucun test existant ne couvre, avec \`chemin:ligne\`.
N'invente pas de critère : si la consigne ne donne pas les AC, déduis-les des exigences et dis-le.`,
  },
  ui: {
    model: "gpt-5.6-terra",
    effort: "medium",
    timeoutMinutes: 8,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : auditer l'interface modifiée par le diff de ${CONTEXT_FILE}, sur deux axes.
1. Accessibilité : labels et noms accessibles, attributs aria, rôles, ordre et visibilité du focus, usage au clavier, messages d'erreur reliés aux champs, contraste des tokens de couleur de src/app/globals.css dans les thèmes clair et sombre.
2. Textes FR/EN (exigence UI-5) : texte visible codé en dur, clé présente dans un dictionnaire et absente de l'autre, traduction fausse ou incohérente, ton inadapté à des 12-17 ans. Trouve les dictionnaires dans le dépôt avant de juger.
Lis la section « UI provisoire » de CLAUDE.md : l'absence de style travaillé est voulue, ne la signale pas.
${FINDINGS_FORMAT}`,
  },
};

export function buildPrompt(task: Task, instruction: string): string {
  const contextStep =
    task.context === "diff" ? `Commence par lire le contexte préparé : ${CONTEXT_FILE} (à la racine de ton dossier de travail).\n` : "";
  return `Tu assistes l'orchestrateur Claude du projet Typio. C'est une consultation en lecture seule : tu ne modifies rien, tu ne crées aucun fichier.
Ton dossier de travail est une copie du dépôt, sans l'historique git ni les secrets : les commandes git n'y marchent pas. Reste dans ce dossier.
Les consignes de tâche d'AGENTS.md (plan-salle-temps-reel, gemini-task-workflow) ne s'appliquent pas à cette consultation : ne les suis pas.
Le web et l'installation de paquets sont interdits ; utilise seulement des commandes de lecture (rg, Get-Content, Get-ChildItem, Select-String).
${contextStep}Réponds en français, en Markdown concis, sans préambule ni formule de politesse. Chemins relatifs à la racine du dépôt.
Ne lis rien hors de ton dossier de travail, en particulier aucun fichier \`.env*\` ni aucun dossier \`~/.codex\`.
Ta réponse sera vérifiée : un constat faux coûte plus cher qu'un constat manquant.

${task.instructions}

Consigne de l'orchestrateur : ${instruction || "aucune consigne particulière."}`;
}

export type WriteTaskName = "implement" | "qa";

/**
 * Niveaux d'`implement`. Le niveau 3 n'existe pas ici : c'est Sonnet, côté Claude, qui le prend.
 * 1 : changement mécanique ; 2 : fonctionnalité simple et cadrée ; 4 : difficile, peu de code.
 */
export type Level = 1 | 2 | 4;

export const IMPLEMENT_PROFILES: Record<Level, Profile> = {
  1: { model: "gpt-6-luna", effort: "medium", timeoutMinutes: 15 },
  2: { model: "gpt-5.6-terra", effort: "medium", timeoutMinutes: 30 },
  4: { model: "gpt-6.1-sol", effort: "medium", timeoutMinutes: 30 },
};

export const QA_PROFILE: Profile = { model: "gpt-5.6-terra", effort: "medium", timeoutMinutes: 30 };

/** Lit `--level` : seuls 1, 2 et 4 existent, et 3 reçoit un message qui dit où il se trouve. */
export function parseLevel(value: string | undefined): Level {
  if (value === undefined) throw new UsageError("implement demande --level 1, 2 ou 4.");
  if (value === "3") throw new UsageError("Le niveau 3 n'existe pas dans le wrapper : c'est Sonnet, côté Claude.");
  const level = ([1, 2, 4] as const).find((candidate) => String(candidate) === value);
  if (!level) throw new UsageError(`Niveau inconnu : ${value} (attendu : 1, 2 ou 4).`);
  return level;
}

export function resolveWriteProfile(task: WriteTaskName, level: Level | undefined): Profile {
  if (task === "qa") return QA_PROFILE;
  if (level === undefined) throw new UsageError("implement demande --level 1, 2 ou 4.");
  return IMPLEMENT_PROFILES[level];
}

export type WritePromptOptions = {
  task: WriteTaskName;
  level?: Level;
  /** Contenu du fichier de brief, inclus tel quel. */
  brief: string;
  /** Raison donnée à `--sortie-bac-a-sable`, si le bac à sable est levé. */
  sandboxExitReason?: string;
};

export function buildWritePrompt({ task, level, brief, sandboxExitReason }: WritePromptOptions): string {
  const role = task === "qa" ? "Tâche : qa (validation et tests)." : `Tâche : implement, niveau ${level}.`;
  const skills =
    task === "qa"
      ? "Lis et applique d'abord .agents/skills/code-quality/SKILL.md et .agents/skills/qa/SKILL.md."
      : "Lis et applique d'abord .agents/skills/code-quality/SKILL.md, puis .agents/skills/qa/SKILL.md pour les tests unitaires que tu écris.";
  const qaRules =
    task === "qa"
      ? "\nTu valides le changement décrit par le brief : écris les tests manquants qu'il demande et rapporte fidèlement chaque échec, tel quel. Ne modifie pas le code applicatif pour faire passer un test, sauf si le brief le demande."
      : "";
  const exit = sandboxExitReason
    ? `\nLe bac à sable est levé exceptionnellement, pour cette raison : « ${sandboxExitReason} ». N'utilise cette liberté que pour cela.`
    : "";
  const withoutDependencies = task === "implement" && level === 1;
  const dependencies = withoutDependencies
    ? "sans dépendances (node_modules absent : ne lance ni lint, ni tsc, ni tests ; les types des paquets ne sont pas disponibles)"
    : "dépendances installées";
  return `Tu es l'exécutant de l'orchestrateur Claude du projet Typio. ${role}
Ton dossier de travail est une copie du dépôt créée pour cette tâche, sans historique git, ${dependencies} : les commandes git n'y marchent pas. Modifie des fichiers de ce dossier, et seulement de ce dossier. Ne crée ni dossier ou fichier \`.git\`, ni \`.gitmodules\`, ni lien symbolique, ni jonction, ni dossier \`.codex\`, ni nouveau fichier \`.env*\` ou clé : l'orchestrateur refuse tout le travail qui en contient. Ne lis rien hors de ton dossier de travail, en particulier aucun fichier \`.env*\` ni aucun dossier \`~/.codex\`.
${skills}${qaRules}
Interdits : git commit, push, checkout, branch, stash, reset et worktree. L'orchestrateur commite lui-même.
Ne modifie pas CLAUDE.md, AGENTS.md, .claude/**, .agents/**, scripts/codex/** ni scripts/gemini/**, sauf si le brief le demande explicitement.
Les sections de tâche d'AGENTS.md (salle temps réel, gemini-task-workflow) ne s'appliquent pas à cette tâche ; le contrat src/realtime/protocol.ts est figé.
Tout texte visible est ajouté en français et en anglais ensemble, dans les dictionnaires.
En cas d'ambiguïté (modèle de données, règle produit, nouvelle dépendance), arrête-toi et signale-la au lieu d'improviser.
Lance les commandes de vérification que le bac à sable te permet. Après toi, l'orchestrateur lance lui-même lint, test et build : ne prétends jamais avoir lancé ce que tu n'as pas lancé.${exit}

Réponse finale en français, sans préambule : les fichiers modifiés ; pour chaque AC du brief, ce qui est fait ; les commandes lancées avec leur résultat réel ; les questions ouvertes.

# Brief de l'orchestrateur

${brief}`;
}
