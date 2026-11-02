@AGENTS.md
@.claude/workflow/orchestrator.md

# Configuration du projet

- Description : plateforme de courses de dactylographie multijoueur (Next.js 16, Bun, PostgreSQL via Drizzle, Socket.IO pour le temps réel).
- Commandes de vérification :
  - lint : `bun run lint` ;
  - types : `bunx tsc --noEmit` (TECH-09) ;
  - tests ciblés : `bun run test <fichier>` ; suite complète : `bun run test` (le test d'intégration `src/auth/repositories.integration.test.ts` exige une base PostgreSQL : `DATABASE_URL`) ;
  - build : `bun run build`, plus `bun run build:realtime` si `src/realtime/` change ;
  - schéma : `bun run db:generate` après toute modification de `src/db/schema.ts`, migration versionnée commitée avec.
- QA d'une grosse feature : la suite complète et les deux builds, puis les critères d'acceptation joués dans l'app (`.claude/launch.json` : `typio-dev` et `typio-realtime`), en FR et EN, en thème clair et sombre.
- Branches : `main` stable, `develop` branche d'intégration. Une branche courte par tâche à partir de `develop` à jour, nommée `<type>/<description-en-anglais>` (ex. `feat/race-results`). Micro-tâche : branche quand même, rien ne se fait sur `develop` ni `main`.
- Intégration : PR vers `develop`, fusionnée en squash avec l'accord de l'utilisateur. `develop` → `main` par merge classique. Le déploiement reste manuel (README).
- Commits et push : autorisés sur la branche de tâche à chaque jalon cohérent et vérifié, jamais sur `develop` ni `main`, jamais de force-push. Message en anglais : `<type>(<scope>): <description>` (scopes : `race`, `room`, `auth`, `realtime`, `ui`, `db`, `config`…), avec l'identifiant d'exigence dans le corps quand il y en a un.
- Zones sensibles (`security-review`) : authentification, sessions et cookies, OAuth GitHub et Discord, confiance du serveur temps réel envers les clients, validation serveur de la progression et anti-triche (COURSE-06), droits de l'hôte (SEC-01, SALLE-07, SALLE-08), création de salle réservée aux membres (AUTH-03, SALLE-01), liens d'invitation (SALLE-04), mots de passe (SEC-03), téléversements (SEC-02, AUTH-04), force brute du code (SALLE-10), une seule salle par personne (SALLE-06). Les utilisateurs ont de 12 à 17 ans : données personnelles au strict minimum.

# Produit

Typio est une plateforme de courses de dactylographie multijoueur pour les 12-17 ans.
Les exigences sont dans [docs/enonce.md](docs/enonce.md), qui fait foi, et leur état
est suivi dans [docs/EXIGENCES.md](docs/EXIGENCES.md). Mets cette matrice à jour à
chaque fusion dans `develop`, avec des statuts honnêtes **complet / partiel / non fait** :
une fausse déclaration « complet » est pénalisée. L'objectif du checkpoint est dans
[docs/checkpoint-1.md](docs/checkpoint-1.md). Cite toujours l'identifiant au format de
l'énoncé (`SALLE-04`, `COURSE-06`…) dans un plan, un brief ou un commit.
Les choix sur les ambiguïtés (H-1 à H-18 et suivants) sont dans la section
« Choix documentés » de `EXIGENCES.md` : ajoute tout nouveau choix à cette section
(§ 2.2 de l'énoncé). Ne réinvente pas une règle déjà tranchée.
[docs/cahier-des-charges.md](docs/cahier-des-charges.md) reste la copie du livrable,
avec ses anciens identifiants ; utilise la table de correspondance de `EXIGENCES.md`.

# Contraintes de l'énoncé pour tout code

- **TECH-02** : TypeScript à 100 % ; aucun fichier `.js`/`.jsx`/`.mjs`, aucun `any` explicite, aucun `@ts-ignore`/`@ts-expect-error` sans commentaire justificatif. Exception : l'outillage des agents (`.claude/`, dont `delegate.mjs`) n'est pas du code de l'application ; on n'y touche pas.
- **TECH-07** : toute entrée serveur est validée par un schéma Zod (actions serveur, routes API, messages temps réel).
- **TECH-10** : `.env.example` à jour, aucun secret commité.
- **PERF-02** : progression regroupée ou limitée à environ 10 messages/s par joueur ; aucune écriture en base à chaque frappe.
- **Annexe A** : MPM net = (caractères correctement tapés ÷ 5) ÷ minutes écoulées ; MPM brut = (total des caractères tapés ÷ 5) ÷ minutes écoulées ; précision = frappes correctes ÷ frappes totales × 100 ; progression = caractères validés ÷ longueur totale du texte, bonus inclus. Les espaces comptent comme caractères.
- **A11Y-02** : utiliser les balises sémantiques adaptées.

# UI provisoire

La direction artistique se fait dans Figma. Un skill `ui` la remplacera, puis une refonte
suivra. D'ici là :

- UI **basique et neutre** : palette Tailwind par défaut (gris + une couleur d'accent), police système, aucune illustration ni animation décorative. Pas d'effort de style, effort de structure et d'accessibilité.
- **Thème clair et sombre obligatoire** (DES-05) : suit la préférence système par défaut, bascule manuelle mémorisée, aucun flash au chargement. Chaque composant est vérifié dans les deux thèmes.
- **Français et anglais obligatoires** (I18N-01) : aucun texte visible codé en dur, toutes les chaînes sont dans les dictionnaires FR et EN, ajoutées ensemble. Le français est la langue par défaut. Sélecteur de langue (I18N-02) et dates/nombres formatés selon la langue (I18N-03).
- **Responsive** (DES-06) : dès 360 px, mobile, tablette, ordinateur. Sur mobile, la course est remplacée par un message recommandant un clavier physique.
- **Préparer la refonte** : couleurs passées par des variables CSS (tokens) dans `globals.css`, petits composants partagés dans `src/components/` (bouton, champ, carte). La refonte doit pouvoir changer les tokens et ces composants sans toucher à la logique.

La version finale devra respecter DES-04 (design unique, piste de progression comme élément signature) et A11Y-01 à A11Y-04 ; le nom et le logo viennent de Patrick, jamais d’une IA (DES-01, DES-02).
