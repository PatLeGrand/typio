# Checkpoint 1 — périmètre et répartition

Référence : [énoncé, section 7](enonce.md#7-checkpoint-1-15-). État au 27 octobre 2026 ;
le relevé historique du 5 octobre est conservé ci-dessous.

## Les cinq livrables (§ 7.1)

| Livrable | État réel et preuves | Qui / manque |
|---|---|---|
| `docs/DEMARCHE-CREATIVE.md` complet (DES-01 à DES-03) | **partiel** : [squelette créé](DEMARCHE-CREATIVE.md), logo dans `src/components/Logo.tsx`, direction artistique dans `docs/design/`, tokens dans `src/app/globals.css` | Patrick : noms envisagés, originalité, croquis, logo, moodboard, palette et typographies à documenter avec images. Le nom et le logo remis sont définitifs. |
| `docs/ARCHITECTURE.md`, version initiale | **complet** pour le document initial : [modèle de données, machine à états, ADR temps réel et approche bots](ARCHITECTURE.md) (COURSE-01, TECH-04, TECH-06) | orchestrateur ; la cible documentée reste à implémenter, notamment les bots multijoueurs. |
| Application déployée en HTTPS | **partiel** au regard des exigences finales : dernière production vérifiée le 9 octobre, `sha-994ac37`, https://typio.aether-manager.ca ; preuves : `infra/docker-compose.yml`, `infra/caddy/typio.caddyfile`, `src/auth/`, `src/db/schema.ts`, `drizzle/`, `src/realtime/`, `src/components/LanguageSwitcher.tsx`, `ThemeToggle.tsx`, `Logo.tsx`, `src/app/globals.css` | orchestrateur (infra), `implementer` et `security-reviewer` : revérifier production, auth (AUTH-01), migrations (TECH-04), création/jonction et liste en direct (SALLE-01, SALLE-02, JOIN-01), langue/thème (I18N-02, DES-05), logo/palette/typographies. Écarts finaux dans `EXIGENCES.md` : seed, créateur spectateur, code sur l'accueil. |
| Intégration continue et tests unitaires (TECH-09) | **complet** : `.github/workflows/ci.yml`, `vitest.config.mts`, `src/**/*.test.ts(x)` ; sur chaque push : `tsc --noEmit`, tests, lint, builds, migrations et intégration PostgreSQL | — |
| `docs/EXIGENCES.md`, version initiale | **complet** : [matrice créée](EXIGENCES.md), exigences, statuts et preuves listés | Maintenir les statuts honnêtes à chaque fusion dans `develop`. |

## Grille d'évaluation (§ 7.2)

| Critère | Points | État / preuve ou manque |
|---|---|---|
| Cahier des charges | 20 | Copie du livrable : [cahier-des-charges.md](cahier-des-charges.md) ; vérifier le Word remis avec Patrick. L'[énoncé final](enonce.md) fait foi pour le développement. |
| Démarche créative et direction artistique (nom, logo, moodboard, palette, typographies) | 20 | **partiel** : `DEMARCHE-CREATIVE.md` à compléter par Patrick (DES-01 à DES-03). |
| Architecture : modèle de données, machine à états, ADR temps réel | 20 | **complet** pour la version initiale : `ARCHITECTURE.md`, approche bots incluse. |
| Déploiement fonctionnel en production : HTTPS, authentification, base de données | 20 | Déploiement vérifié le 9 octobre (`sha-994ac37`) ; à revérifier avant remise, écarts finaux TECH-04 dans `EXIGENCES.md`. |
| Salle créée et rejointe par code, mise à jour en temps réel | 10 | Fonctionnel selon le relevé historique : `src/realtime/`, `reprise/etape-1-salle-temps-reel.md` ; SALLE-01 et JOIN-01 restent **partiels** selon `EXIGENCES.md`. |
| Intégration continue, langue et thème, qualité initiale du code, matrice des exigences | 10 | CI complète (TECH-09) ; I18N-02 et DES-05 **complets** ; matrice `EXIGENCES.md` créée, conformité technique restante documentée. |
| **Total** | **100** | Aucun score obtenu n'est présumé. |

## Ordre proposé

1. Patrick complète la démarche créative (DES-01 à DES-03).
2. Vérifier la version initiale de l'architecture et son approche bots.
3. Revérifier l'application déployée et les parcours du checkpoint.
4. ~~Compléter la CI (TECH-09)~~ (fait), puis actualiser la matrice des exigences.

## Architecture

- [ADR-001 — service temps réel séparé](ARCHITECTURE.md#adr-001) : Socket.IO, même image, second service compose, route `/socket.io/*` dans Caddy.
- [Machine à états](ARCHITECTURE.md#machine-a-etats) : salle, rôle d'hôte, coureur.
- [Modèle de données](ARCHITECTURE.md#modele-de-donnees) : seules `users` et `sessions` servent au checkpoint.

## À faire plus tard

- **Réviser H-13 dans le Word** (Patrick) : hébergement sur le VPS, avec un renvoi vers l'ADR-001.
- **Confirmer avec le client** qu'un invité peut hériter du rôle d'hôte (voir la machine à états, § 2).

## État au 5 octobre 2026

- ✅ Architecture validée par Patrick : arrondis, invité héritier du rôle d'hôte, fermeture
  des résultats après 10 min.
- ✅ Déploiement en production : HTTPS (Caddy), authentification des membres et des invités,
  PostgreSQL (tables `users` et `sessions`). Version en ligne : `sha-994ac37` (9 octobre 2026),
  avec le service `realtime` derrière Caddy (`/socket.io/*`).
- ✅ Langue et thème : FR/EN, clair/sombre, direction artistique Figma.
- ✅ Intégration continue : tests, lint, build, migrations et tests d'intégration PostgreSQL.
- ✅ Salle créée et rejointe par code, mise à jour en temps réel (PR #40) : création par un
  membre, jonction par code (membre ou invité), liste et configuration en direct, reprise
  après rechargement, départ et transfert d'hôte. Détails et suites reportées :
  [reprise/etape-1-salle-temps-reel.md](reprise/etape-1-salle-temps-reel.md).
- ⬜ Matrice des exigences.

**Risque connu :** un élève qui connaît l'identifiant d'un camarade peut le bloquer 15 min
depuis la même IP (5 échecs). La parade, un cookie d'appareil, est prévue après le
checkpoint.
