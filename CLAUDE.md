@AGENTS.md

# Produit

Typio est une plateforme de courses de dactylographie multijoueur pour les 12-17 ans.
Les exigences (identifiants `SALLE-4`, `H-9`…) sont dans
[docs/cahier-des-charges.md](docs/cahier-des-charges.md), et l'objectif en cours dans
[docs/checkpoint-1.md](docs/checkpoint-1.md). Cite toujours l'identifiant d'exigence
dans un plan, un brief ou un commit. Ne réinvente pas une règle déjà tranchée dans
les hypothèses (H-1 à H-18).

# Orchestration

La session principale (Opus) est l'**orchestrateur**. Elle planifie, tranche, découpe
en briefs, délègue, vérifie, puis commite. Les agents de `.claude/agents/` exécutent.
Chacun lit le skill de `.agents/skills/` qui correspond à son rôle.

| Tâche | Qui | Skill appliqué |
|---|---|---|
| Recherche, lecture de code ou de doc, « où est X ? » | Gemini `search` ; `scout` (haiku) s'il est indisponible | gemini-delegation |
| Second avis sur un diff : relecture, cas de test, accessibilité et textes FR/EN, captures d'écran | Gemini `review`, `tests`, `ui`, `visual`, en parallèle de la chaîne Claude | gemini-delegation |
| Changement mécanique exactement spécifié : clés FR/EN, texte, renommage, classes, lint, tableaux de doc | `implementer-light` (haiku) | code-quality |
| Fonctionnalité, page, composant ou correctif cadré par des critères AC-n, avec ses tests unitaires | `implementer` (sonnet) | code-quality + qa (couverture) |
| Lancer lint/build/tests, scénarios d'acceptation, registre de validation | `qa` (sonnet) | qa |
| Relecture de tout diff applicatif | `code-reviewer` (sonnet) | code-review |
| Auth, sessions, cookies, OAuth, confiance WebSocket, anti-triche, liens d'invitation | `security-reviewer` (opus) | security-review |
| Plan d'une fonctionnalité, modèle de données, machine à états, ADR, protocole temps réel, infra/Docker/DB, debug sans cause connue, git | **orchestrateur** | feature-planning, git-branch, git-commit |

Règles :

1. **Plan avant code.** Tout ce qui dépasse quelques lignes passe d'abord par `feature-planning`, puis le plan est découpé en briefs.
2. **Brief autonome.** Un agent ne voit pas la conversation. Le brief donne les exigences citées, les fichiers, les critères AC-n, les décisions déjà prises et ce qu'il ne faut pas toucher.
3. **Le moins cher qui suffit.** Si un agent s'arrête sur une ambiguïté, l'orchestrateur tranche ou remonte d'un niveau. Il ne relance pas le même brief.
4. **Parallèle si indépendant**, séquentiel si les agents touchent les mêmes fichiers.
5. **Chaîne de validation :** implémentation → `qa` → `code-reviewer` (+ `security-reviewer` si surface sensible) → commit par l'orchestrateur. Aucun agent ne commite ni ne pousse. En parallèle, Gemini `review` sur tout diff applicatif, plus `ui` et `visual` si l'interface change.
6. **Résultats fidèles.** Un échec se rapporte tel quel ; un check non lancé n'est pas un check réussi.
7. **Gemini d'abord, en lecture seule.** Il passe avant `scout` et donne un second avis, mais ne valide rien. L'orchestrateur vérifie chaque constat avant de le relayer ou de le corriger. S'il est indisponible (code 2), on continue comme avant, sans réessayer.

# UI provisoire

La direction artistique se fait dans Figma. Un skill `ui` la remplacera, puis une refonte
suivra. D'ici là :

- UI **basique et neutre** : palette Tailwind par défaut (gris + une couleur d'accent), police système, aucune illustration ni animation décorative. Pas d'effort de style, effort de structure et d'accessibilité.
- **Thème clair et sombre obligatoire** (UI-3) : suit la préférence système par défaut, bascule manuelle mémorisée, aucun flash au chargement. Chaque composant est vérifié dans les deux thèmes.
- **Français et anglais obligatoires** (UI-5) : aucun texte visible codé en dur, toutes les chaînes sont dans les dictionnaires FR et EN, ajoutées ensemble. Le français est la langue par défaut.
- **Responsive** (UI-4) : mobile, tablette, ordinateur.
- **Préparer la refonte** : couleurs passées par des variables CSS (tokens) dans `globals.css`, petits composants partagés dans `src/components/` (bouton, champ, carte). La refonte doit pouvoir changer les tokens et ces composants sans toucher à la logique.
