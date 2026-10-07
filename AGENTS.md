<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Infrastructure — à lire avant de toucher à Docker ou à la base de données

La spécification de la stack Docker et du PostgreSQL partagé du VPS est dans
[docs/stack-docker-postgresql.md](docs/stack-docker-postgresql.md).

Trois points y sont contre-intuitifs et coûteux à redécouvrir seul :

- **Le VPS ne construit jamais l'image** (1,9 Go de RAM, OOM killer). Il tire
  depuis GHCR. Ne jamais ajouter un `build:` à `infra/docker-compose.yml`.
- **La base est partagée** avec les sept API de « carte ». Les données sont
  cloisonnées, le sort ne l'est pas.
- **Le bundle `output: standalone` ne suit que le graphe de Next.** Tout script
  lancé hors de Next (migrations, futur serveur temps réel) doit être copié
  explicitement dans l'image `runner`, avec ses dépendances : voir le
  `Dockerfile` pour `scripts/migrate.ts`.

# Travail délégué en cours — salle en temps réel

Antigravity/Gemini : pour toute tâche qui modifie ce dépôt, appliquer la skill
[`gemini-task-workflow`](.agents/skills/gemini-task-workflow/SKILL.md) : analyser le code et
les contraintes, identifier le changement nécessaire, le réaliser, puis le tester et rendre
compte des résultats. Les consultations via `scripts/gemini/run.ts` restent en lecture seule.

Agents externes (Codex, Antigravity) : la tâche en cours est décrite lot par lot dans
[docs/plan-salle-temps-reel.md](docs/plan-salle-temps-reel.md). Le contrat
`src/realtime/protocol.ts` est figé : ne pas le modifier, signaler un manque. Aucun commit
sur `develop` ou `main`, aucun push, aucun déploiement.
