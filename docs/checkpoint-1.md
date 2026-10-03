# Checkpoint 1 — périmètre et répartition

Grille d'évaluation (100 points). Tout ce qui n'y figure pas attend après le checkpoint.

| Critère | Pts | Livrable | Qui | Exigences |
|---|---|---|---|---|
| Cahier des charges | 20 | Le Word. Copie de travail : [cahier-des-charges.md](cahier-des-charges.md) | Patrick | — |
| Démarche créative et DA (nom, logo, moodboard, palette, typographies) | 20 | Figma, puis le skill `ui` | Patrick | UI-1, UI-2 |
| Architecture : modèle de données, machine à états, ADR temps réel | 20 | `docs/architecture/` : modèle de données, machine à états de la course, ADR | orchestrateur | SALLE-*, COURSE-1 à 3, TECH-3, TECH-4 |
| Déploiement en production : HTTPS, authentification, base de données | 20 | Site en ligne sur le VPS (Caddy pour le HTTPS), connexion et invité, PostgreSQL partagé | orchestrateur (infra) + `implementer` (auth) + `security-reviewer` | TECH-5, AUTH-1, AUTH-4, AUTH-5, TECH-3 |
| Salle créée et rejointe par code, mise à jour en temps réel | 10 | Un membre crée une salle, un autre client la rejoint par code, la liste des participants et la config se mettent à jour sans recharger | orchestrateur (protocole) + `implementer` | SALLE-1, SALLE-4, SALLE-7, SALLE-10, SALLE-12, H-5 |
| CI, langue et thème, qualité du code, matrice des exigences | 10 | CI tests + lint + build : **existe** (`.github/workflows/ci.yml`, Vitest) ; FR/EN et clair/sombre ; `docs/matrice-exigences.md` | `implementer` (i18n, thème) + `implementer-light` (matrice) + `qa` | UI-3, UI-5, QA-1, QA-3 |

## Ordre proposé

1. **Architecture** (débloque tout le reste) : modèle de données, machine à états, ADR temps réel.
2. **Socle UI** : i18n FR/EN, thème clair/sombre, composants de base, en UI provisoire (voir `CLAUDE.md`).
3. **Base de données et authentification** : schéma Drizzle (`src/db/schema.ts`, vide pour l'instant), connexion par identifiants, mode invité. La chaîne de migration existe déjà (`bun run db:migrate`, copiée dans l'image).
4. **Salle par code en temps réel.**
5. **Déploiement**, puis la matrice des exigences, mise à jour en fin de parcours.

## Architecture

- [ADR-001 — service temps réel séparé](architecture/adr-001-temps-reel.md) : Socket.IO, même image, second service compose, route `/socket.io/*` dans Caddy.
- [Machine à états](architecture/machine-a-etats.md) : salle, rôle d'hôte, coureur.
- [Modèle de données](architecture/modele-de-donnees.md) : seules `users` et `sessions` servent au checkpoint.

## À faire plus tard

- **Réviser H-13 dans le Word** (Patrick) : hébergement sur le VPS, avec un renvoi vers l'ADR-001.
- **Confirmer avec le client** qu'un invité peut hériter du rôle d'hôte (voir la machine à états, § 2).
