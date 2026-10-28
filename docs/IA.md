# Utilisation de l'IA

Ce document vise 1 à 2 pages une fois complété. La configuration versionnée
prouve les rôles et outils prévus ; elle ne prouve pas à elle seule quels agents
ont été exécutés pour chaque contribution. Patrick doit confirmer son usage réel.

## Agents et outils utilisés

Le dépôt versionne les instructions de travail dans `CLAUDE.md`, `AGENTS.md`,
`.claude/workflow/orchestrator.md`, `.claude/agents/` et `.claude/skills/`.
`CLAUDE.md` importe les deux fichiers d'instructions principaux et précise les
commandes de vérification, les branches et les règles produit.

| Agent ou outil | Rôle défini dans le dépôt | Source |
|---|---|---|
| Claude Opus | Orchestrateur : comprend, classe, planifie, délègue, arbitre et vérifie les lots. | `.claude/workflow/orchestrator.md` |
| Claude Haiku, `researcher` | Recherche et exploration ciblées ; ne modifie pas les fichiers. | `.claude/agents/researcher.md` |
| Claude Sonnet, `sonnet-dev` | Implémentation des lots volumineux ou délicats et reprise des échecs difficiles. | `.claude/agents/sonnet-dev.md` |
| Codex Luna et Sol | Délégation des micro-changements à Luna et des patchs ciblés à Sol. | `.claude/scripts/delegate.mjs`, `.claude/workflow/orchestrator.md` |
| Gemini 3.8 Flash | Revue indépendante du diff final ; ne modifie rien dans ce rôle. | `.claude/workflow/orchestrator.md`, `.claude/scripts/delegate.mjs` |

Le script `delegate.mjs` transmet un brief et les consignes choisies aux agents
externes. Les skills commités encadrent notamment le patch minimal, la transmission
des tâches, la documentation et la vérification. Le workflow demande des contrôles
déterministes avant la revue par un modèle. `AGENTS.md` impose aussi la lecture
de la documentation locale de Next avant de coder et renvoie aux contraintes
d'infrastructure du projet.

> À compléter par Patrick : confirmer les agents réellement employés, la période,
> les tâches confiées et le contrôle humain effectué. Distinguer la configuration
> actuelle des outils utilisés plus tôt dans le projet.

## Trois situations où l'IA s'est trompée

Les éléments suivants sont des **pistes à confirmer**, pas des récits attribués
à Patrick. Les commits prouvent des corrections ; ils n'établissent pas seuls
l'origine IA du défaut. Pour chaque situation, retenir un cas vécu et documenté.

### Situation 1 — Code proposé incompatible avec le projet

> À compléter par Patrick : citer la demande, la proposition erronée, le symptôme,
> la vérification qui l'a révélé, la correction et la leçon retenue.

- **Piste à confirmer :** props inexistantes dans la page profil et dix erreurs
  de types au build ; audit de `docs/reprise/README.md`, § 1.
- **Piste à confirmer :** tests bloqués par `HTMLDialogElement is not defined`
  dans le setup ; même audit. Correction à examiner : `15f1f3e`
  (`fix(profile): restore a green develop and a working profile page`).

### Situation 2 — Comportement temps réel mal anticipé

> À compléter par Patrick : décrire le scénario réel, l'hypothèse erronée de
> l'agent, la reproduction à plusieurs clients et la correction vérifiée.

- **Piste à confirmer :** quitter une salle réinscrivait l'hôte comme participant
  fantôme ; audit de `docs/reprise/README.md`, § 1. Voir `57453fb`
  (`fix(realtime): make room membership survive reloads, tabs and leaves`).
- **Piste à confirmer :** absence de gestion de `connect_error` et salle créée
  malgré une erreur affichée ; même audit. Voir `8c9f47a`
  (`fix(realtime): recover the room client from expiry, timeouts and logout`).

### Situation 3 — Diagnostic ou calcul accepté trop vite

> À compléter par Patrick : montrer la réponse ou le calcul erroné, les preuves
> qui l'ont contredit, la décision humaine et la vérification après correction.

- **Piste à confirmer :** faux P0 de Gemini affirmant que le middleware
  d'authentification n'était pas branché ; `docs/reprise/README.md`, § 1,
  « Fausses alertes écartées ».
- **Piste à confirmer :** horloge solo avançant de 100 ms par tick et précision
  fausse après une erreur ; même audit. Voir `742a2a7`
  (`feat(race): rebuild the solo race screen with real timing and results`)
  et `2bb39bf` (`fix(race): address review findings on the solo race and its settings`).

## Réflexion

> À compléter par Patrick : expliquer ce que l'IA a apporté, ce qu'elle a mal
> évalué, comment ses réponses ont été contrôlées et ce qui a été appris.
> Préciser les décisions restées humaines, les limites de la délégation et les
> changements de méthode retenus. Relier cette réflexion aux trois situations
> confirmées, sans inventer d'expérience personnelle.
