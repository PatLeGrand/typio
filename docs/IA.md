# Utilisation de l'IA

## Agents et outils utilisés

Typio a été développé avec plusieurs agents, sur des modèles de plusieurs
éditeurs (Anthropic, OpenAI, Google), coordonnés par un orchestrateur. Les
instructions sont commitées dans le dépôt : `CLAUDE.md`, `AGENTS.md`,
`.claude/workflow/orchestrator.md`, `.claude/agents/` et `.claude/skills/`.

| Agent | Modèle | Rôle |
|---|---|---|
| Orchestrateur | Claude Opus | Comprend la demande, classe la tâche, rédige les briefs, délègue, vérifie (types, lint, tests, builds, navigateur), gère branches et PR. N'écrit pas le code lui-même. |
| Développeur | Claude Sonnet (`sonnet-dev`) et Sol via Codex (`delegate.mjs sol`) | Implémente les lots à partir d'un brief court. |
| Reviewer | Gemini (`delegate.mjs gemini`) | Relit le diff complet d'une feature terminée : bugs, régressions, cas limites, sécurité. Ne modifie rien. |
| Reviewer adversaire | `ui-adversary` (ajouté vers la fin du projet) | Cherche à prouver qu'un écran terminé casse : design, accessibilité, traductions, cas limites, sur le rendu réel. |
| Code propre | `react-next-refactorer` | Audit puis refactoring React 19 / Next 16 sans changer le comportement (PR #114). |

Le script `.claude/scripts/delegate.mjs` transmet un brief et les skills choisis
aux agents externes (Codex, Gemini) et ne renvoie que leur compte rendu final.
Les skills (`minimal-patch`, `task-handoff`, `verification`, `security-review`,
`ui`…) fixent les règles communes à tous les agents.

## Trois situations où l'IA s'est trompée

### 1. Une consigne visuelle mal interprétée (PR #119 puis #121)

- **Demande :** « le texte est aligné trop à gauche » sur les formulaires.
- **Erreur :** l'orchestrateur a décidé d'aligner les libellés, aides et
  compteurs sur le texte *intérieur* des champs (16 px de retrait). Les tests,
  le lint et les types passaient, et la PR a été fusionnée et déployée.
- **Détection :** en relisant la page de réglages, j'ai vu que le cadre de
  chaque champ dépassait maintenant à gauche de son libellé. Je l'ai signalé
  avec une capture annotée.
- **Correction :** la PR #121 remet libellés, aides et erreurs au bord du cadre
  du champ, en gardant le retrait du texte dans le champ. Vérifié en mesurant
  les positions dans le navigateur (libellé et champ au même x).
- **Leçon :** une consigne visuelle vague doit être confirmée sur une capture
  avant d'être codée ; des tests verts ne disent rien de l'apparence.

### 2. Un écran « terminé » qui ne l'était pas (PR #116)

- **Demande :** un écran de course immersif comme le héros de l'accueil : piste
  pleine largeur, carte de frappe flottante, classement flottant à droite.
- **Erreur :** le développeur (Sol) a rendu un patch qui passait lint, types et
  tests, mais dans l'application réelle la piste ne faisait que 260 px de haut
  (ciel et nuages coupés), le classement défilait déjà avec trois coureurs (le
  joueur était caché) et le titre n'était pas aligné sur le logo de l'en-tête.
- **Détection :** l'orchestrateur a lancé l'application et mesuré la page dans
  le navigateur (taille du canvas, hauteur du classement, position du titre).
- **Correction :** un second brief, avec ces mesures chiffrées, a demandé une
  hauteur de piste comparable à l'accueil, un classement dont la hauteur suit la
  piste et le conteneur de l'en-tête. Revérifié dans le navigateur avant la PR.
- **Leçon :** pour l'UI, la vérification se fait sur le rendu réel ; un brief
  de correction est plus efficace avec des mesures qu'avec « ça ne ressemble
  pas à l'accueil ».

### 3. Une fausse alerte critique d'un reviewer

- **Situation :** lors d'une review du diff, Gemini a annoncé un problème P0 :
  « le middleware d'authentification n'est pas branché » sur le serveur temps
  réel. Il a aussi attribué une suppression du profil à une erreur de merge.
- **Détection :** chaque constat est vérifié dans le code avant d'être corrigé.
  Le middleware était bien branché (`src/realtime/server.ts`) ; la suppression
  était réelle mais venait d'un commit précis (`dc64318`), pas d'un merge.
- **Correction :** l'alerte sur le middleware a été écartée, sans modifier le
  code ; seule la vraie suppression a été traitée. Les deux cas sont notés dans
  `docs/reprise/README.md` (« Fausses alertes écartées »).
- **Leçon :** une review par IA produit des hypothèses, pas des verdicts. Sans
  vérification, on aurait « corrigé » un code qui fonctionnait.

## Réflexion

Ce projet m'a surtout appris à travailler avec des sous-agents et avec plusieurs
modèles de plusieurs éditeurs, chacun à sa place : Opus pour orchestrer, Sonnet
et Sol pour développer, Gemini pour relire, un reviewer adversaire pour l'UI et
un agent dédié au code propre et au respect des règles de React et Next.js.

Mon premier workflow m'a coûté beaucoup trop de tokens : QA sur chaque PR, agent
de sécurité sur chaque PR, tests unitaires après chaque composant. Le contrôle
était bon, mais le coût était disproportionné pour la plupart des changements.
Je l'ai remplacé par le workflow actuel, décrit dans
`.claude/workflow/orchestrator.md` :

- la tâche est classée par taille et confiée à l'agent au meilleur coût total ;
- les vérifications déterministes (types, lint, tests, builds) passent avant
  tout contrôle par un modèle ;
- une seule review, sur la feature complète, et la revue de sécurité seulement
  dans les zones sensibles ;
- la QA complète seulement pour les grosses features ;
- les tests unitaires seulement quand une erreur passerait inaperçue (calcul,
  règle métier, permission côté serveur, bug qui pourrait revenir).

Les trois situations montrent la limite de la délégation : les agents écrivent
vite du code qui passe les outils, mais l'apparence réelle et la pertinence d'un
constat restent à vérifier. Les décisions sont restées les miennes : le nom et
le logo, la direction artistique dans Figma
([maquettes Typio](https://www.figma.com/design/SqbF9bf8Tsqbd1J4zK1Yl0/Typio-connection)), les choix sur les ambiguïtés de
l'énoncé, et l'accord avant chaque fusion et chaque déploiement.
