@AGENTS.md
@.claude/workflow/orchestrator.md

# Configuration du projet

- Description : plateforme de courses de dactylographie multijoueur (Next.js 16, Bun, PostgreSQL via Drizzle, Socket.IO pour le temps réel).
- Commandes de vérification :
  - lint : `bun run lint` ;
  - tests ciblés : `bun run test <fichier>` ; suite complète : `bun run test` (le test d'intégration `src/auth/repositories.integration.test.ts` exige une base PostgreSQL : `DATABASE_URL`) ;
  - build : `bun run build`, plus `bun run build:realtime` si `src/realtime/` change ;
  - schéma : `bun run db:generate` après toute modification de `src/db/schema.ts`, migration versionnée commitée avec.
- QA d'une grosse feature : la suite complète et les deux builds, puis les critères d'acceptation joués dans l'app (`.claude/launch.json` : `typio-dev` et `typio-realtime`), en FR et EN, en thème clair et sombre.
- Branches : `main` stable, `develop` branche d'intégration. Une branche courte par tâche à partir de `develop` à jour, nommée `<type>/<description-en-anglais>` (ex. `feat/race-results`). Micro-tâche : branche quand même, rien ne se fait sur `develop` ni `main`.
- Intégration : PR vers `develop`, fusionnée en squash avec l'accord de l'utilisateur. `develop` → `main` par merge classique. Le déploiement reste manuel (README).
- Commits et push : autorisés sur la branche de tâche à chaque jalon cohérent et vérifié, jamais sur `develop` ni `main`, jamais de force-push. Message en anglais : `<type>(<scope>): <description>` (scopes : `race`, `room`, `auth`, `realtime`, `ui`, `db`, `config`…), avec l'identifiant d'exigence dans le corps quand il y en a un.
- Zones sensibles (`security-review`) : authentification, sessions et cookies, OAuth GitHub et Discord, confiance du serveur temps réel envers les clients, validation serveur de la progression et anti-triche (COURSE-8), droits de l'hôte (SALLE-9, SALLE-13), création de salle réservée aux membres (SALLE-12), liens et codes d'invitation, mots de passe (AUTH-5). Les utilisateurs ont de 12 à 17 ans : données personnelles au strict minimum.

# Produit

Typio est une plateforme de courses de dactylographie multijoueur pour les 12-17 ans.
Les exigences (identifiants `SALLE-4`, `H-9`…) sont dans
[docs/cahier-des-charges.md](docs/cahier-des-charges.md), et l'objectif en cours dans
[docs/checkpoint-1.md](docs/checkpoint-1.md). Cite toujours l'identifiant d'exigence
dans un plan, un brief ou un commit. Ne réinvente pas une règle déjà tranchée dans
les hypothèses (H-1 à H-18).

# UI provisoire

La direction artistique se fait dans Figma. Un skill `ui` la remplacera, puis une refonte
suivra. D'ici là :

- UI **basique et neutre** : palette Tailwind par défaut (gris + une couleur d'accent), police système, aucune illustration ni animation décorative. Pas d'effort de style, effort de structure et d'accessibilité.
- **Thème clair et sombre obligatoire** (UI-3) : suit la préférence système par défaut, bascule manuelle mémorisée, aucun flash au chargement. Chaque composant est vérifié dans les deux thèmes.
- **Français et anglais obligatoires** (UI-5) : aucun texte visible codé en dur, toutes les chaînes sont dans les dictionnaires FR et EN, ajoutées ensemble. Le français est la langue par défaut.
- **Responsive** (UI-4) : mobile, tablette, ordinateur.
- **Préparer la refonte** : couleurs passées par des variables CSS (tokens) dans `globals.css`, petits composants partagés dans `src/components/` (bouton, champ, carte). La refonte doit pouvoir changer les tokens et ces composants sans toucher à la logique.
