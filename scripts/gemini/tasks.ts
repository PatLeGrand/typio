/**
 * Tâches confiées à Gemini. Chacune est en lecture seule : Gemini lit le
 * contexte préparé par `run.ts`, puis les fichiers du dépôt, et rend un texte court.
 */

export type TaskName = "search" | "review" | "tests" | "ui" | "visual";

export type ContextKind = "files" | "diff" | "screenshots";

export type Task = {
  /** Modèles essayés dans l'ordre : le suivant prend le relais si le précédent échoue (quota, erreur). */
  models: readonly string[];
  timeoutMinutes: number;
  context: ContextKind;
  /** Vrai si la tâche n'a pas de sens sans consigne (une question, par exemple). */
  requiresInstruction: boolean;
  instructions: string;
};

const PRO = "gemini-3.1-pro-high";
const FLASH = "gemini-3.8-flash-high";

const FINDINGS_FORMAT = `Format : une liste de constats, du plus grave au moins grave, au plus 15.
Chaque constat : priorité (P0 à P3, définies dans .agents/skills/code-review/SKILL.md), \`chemin:ligne\`,
le problème en une phrase, le scénario concret qui le déclenche, la correction suggérée en une phrase.
Ne signale que ce que le code justifie. Pas de compliments, pas de remarques de style.
Si tu ne trouves rien, réponds exactement « Aucun constat. ».`;

export const TASKS: Record<TaskName, Task> = {
  search: {
    models: [FLASH, PRO],
    timeoutMinutes: 3,
    context: "files",
    requiresInstruction: true,
    instructions: `Tâche : répondre à une question sur le dépôt (localiser du code, lire une doc, expliquer comment X est fait).
Le contexte liste tous les fichiers du dépôt et la documentation Next.js installée : ouvre ceux qui sont pertinents.
Ce Next.js diffère de tes connaissances : pour toute question sur le framework, appuie-toi sur node_modules/next/dist/docs/.
Les exigences sont dans docs/cahier-des-charges.md (identifiants comme SALLE-4 ou H-9) : cite l'identifiant quand il s'applique.
Format : références \`chemin:ligne\` puis une conclusion de 3 à 10 lignes. Pas de recopie de fichiers.
Si la réponse n'est ni dans le code ni dans la doc, dis-le au lieu de deviner.`,
  },
  review: {
    models: [PRO, FLASH],
    timeoutMinutes: 6,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : relire le diff du contexte et y trouver bugs, régressions, tests manquants et violations des règles.
Lis d'abord CLAUDE.md, .agents/skills/code-review/SKILL.md et .agents/skills/code-quality/SKILL.md.
Ouvre les fichiers modifiés en entier quand le diff ne suffit pas à juger.
Signale aussi si le changement touche à l'authentification, aux sessions, aux cookies, à OAuth, à la confiance WebSocket ou à l'anti-triche : il lui faut une revue de sécurité.
${FINDINGS_FORMAT}`,
  },
  tests: {
    models: [PRO, FLASH],
    timeoutMinutes: 6,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : concevoir les tests du changement décrit par le diff, sans les écrire.
Lis .agents/skills/qa/SKILL.md, les exigences citées dans docs/cahier-des-charges.md et les tests existants voisins des fichiers modifiés.
Rends deux sections :
1. « Cas de test proposés » : cas nominaux, limites, erreurs et scénarios d'acceptation. Pour chacun : fichier de test cible, nom du test, ce qu'il vérifie, exigence ou critère AC concerné. Au plus 20, les plus utiles d'abord.
2. « Trous de couverture » : fonctions, branches ou comportements modifiés qu'aucun test existant ne couvre, avec \`chemin:ligne\`.
N'invente pas de critère : si la consigne ne donne pas les AC, déduis-les des exigences et dis-le.`,
  },
  ui: {
    models: [PRO, FLASH],
    timeoutMinutes: 6,
    context: "diff",
    requiresInstruction: false,
    instructions: `Tâche : auditer l'interface modifiée par le diff, sur deux axes.
1. Accessibilité : labels et noms accessibles, attributs aria, rôles, ordre et visibilité du focus, usage au clavier, messages d'erreur reliés aux champs, contraste des tokens de couleur de src/app/globals.css dans les thèmes clair et sombre.
2. Textes FR/EN (exigence UI-5) : texte visible codé en dur, clé présente dans un dictionnaire et absente de l'autre, traduction fausse ou incohérente, ton inadapté à des 12-17 ans. Trouve les dictionnaires dans le dépôt avant de juger.
Lis la section « UI provisoire » de CLAUDE.md : l'absence de style travaillé est voulue, ne la signale pas.
${FINDINGS_FORMAT}`,
  },
  visual: {
    models: [PRO, FLASH],
    timeoutMinutes: 6,
    context: "screenshots",
    requiresInstruction: false,
    instructions: `Tâche : relecture visuelle. Ouvre chaque image listée dans le contexte avec view_file.
Les captures couvrent mobile, tablette et ordinateur, en thème clair et sombre (exigences UI-3 et UI-4).
Sur mobile, la page occupe les 375 px de gauche : la bande grise unie à droite est le cadre de capture, pas un défaut.
Une image présente dans un thème et absente dans l'autre peut venir d'un chargement différé : marque ce constat « à confirmer ».
Le rond noir marqué « N » en bas à gauche est l'indicateur de développement de Next.js, absent en production : ignore-le.
Un texte secondaire volontairement atténué n'est pas un défaut : ne signale un contraste que si le texte est réellement difficile à lire.
Cherche : débordements et défilement horizontal, éléments coupés ou superposés, texte illisible ou contraste faible,
éléments invisibles ou mal colorés dans un seul des deux thèmes, mise en page cassée à une taille d'écran, cibles tactiles trop petites sur mobile.
Si une image de référence est fournie, compare-la aux captures et liste les écarts.
Lis la section « UI provisoire » de CLAUDE.md : l'absence de style travaillé est voulue, ne la signale pas.
Format : un constat par ligne, avec le nom de la capture, la zone concernée et le problème. Au plus 15.
Si tout est correct, réponds exactement « Aucun constat. ».`,
  },
};

export function buildPrompt(task: Task, root: string, contextFile: string, instruction: string): string {
  return `Tu assistes l'orchestrateur du projet Typio (dépôt : ${root}), en lecture seule.
Ton seul outil autorisé est view_file, avec des chemins absolus. Les commandes, l'écriture et le web sont refusés : ne les tente pas.
Commence par lire le contexte préparé : ${contextFile}
Réponds en français, en Markdown concis, sans préambule ni formule de politesse. Chemins relatifs à la racine du dépôt.
Ta réponse sera vérifiée : un constat faux coûte plus cher qu'un constat manquant.

${task.instructions}

Consigne de l'orchestrateur : ${instruction || "aucune consigne particulière."}`;
}
