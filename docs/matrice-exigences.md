# Matrice des exigences

Ce document fait le lien entre les exigences du [Cahier des charges](cahier-des-charges.md) et leur état d'implémentation actuel. Il est mis à jour au fil des développements.

## État des lieux par domaine

| ID | Exigence | État | Notes / Preuves |
|:---|:---|:---:|:---|
| **Authentification (AUTH)** | | | |
| AUTH-1 | Connexion par identifiant et mot de passe | ✅ | Implémenté (`src/auth/`, formulaires UI, tests) |
| AUTH-2 | Connexion via Discord | ✅ | Implémenté (OAuth, `src/auth/oauth/`) |
| AUTH-3 | Connexion via GitHub | ✅ | Implémenté (OAuth, `src/auth/oauth/`) |
| AUTH-4 | Accès en invité (pseudo) | ✅ | Implémenté (`GuestForm`) |
| AUTH-5 | Mots de passe hachés | ✅ | Implémenté (`argon2` dans `src/auth/password.ts`) |
| AUTH-6 | Aucune récupération de mot de passe | ✅ | Respecté |
| **Salles (SALLE)** | | | |
| SALLE-1 à SALLE-15 | Création, code, invitation, gestion des participants | ⏳ | En attente de l'implémentation WebSockets (ADR-001) |
| **Configuration (CONFIG)** | | | |
| CONFIG-1 à CONFIG-9 | Type, langue, limites, bots, blacklist | ⏳ | À concevoir |
| **Texte & Course (TEXTE / COURSE)** | | | |
| TEXTE-1 à COURSE-8 | Algorithme, classement temps réel, AFK, anti-triche | ⏳ | En attente du moteur de jeu |
| **Bots & Capacités (BOT / CAPA)** | | | |
| BOT-1 à CAPA-6 | Difficulté bots, barre d'énergie, rattrapage | ⏳ | À implémenter plus tard |
| **Résultats & Statistiques (RES / STATS)** | | | |
| RES-1 à STATS-4 | Podium, MPM, Heatmap, historiques | ⏳ | À implémenter plus tard |
| **Interface (UI)** | | | |
| UI-1 | Nom et logo | ✅ | Composant `Logo.tsx` |
| UI-2 | Style professionnel et ludique | ✅ | En place avec Tailwind CSS |
| UI-3 | Thème clair et sombre | ✅ | Implémenté (`src/theme/`, `ThemeToggle.tsx`) |
| UI-4 | Site responsive (ordinateur, tablette, mobile) | ✅ | Utilisation des classes responsives Tailwind |
| UI-5 | Bilingue (FR / EN) | ✅ | Implémenté (`src/i18n/`, `LanguageSwitcher.tsx`) |
| **Technique (TECH)** | | | |
| TECH-1 | Next.js (React) avec TypeScript | ✅ | En place (Next 16, React 19, TS 5) |
| TECH-2 | Tailwind CSS | ✅ | En place (v4) |
| TECH-3 | Base de données PostgreSQL | ✅ | En place (Drizzle ORM, scripts de migration) |
| TECH-4 | WebSockets | ⏳ | Conçu dans `adr-001-temps-reel.md`, à implémenter |
| TECH-5 | HTTPS obligatoire | ✅ | En place via Caddy sur le VPS |
| TECH-6 | Services gratuits | ⏳ | Infrastructure VPS configurée, choix du serveur Socket à confirmer |
| **Qualité (QA)** | | | |
| QA-1 | Tests unitaires | ✅ | Très haute couverture avec `Vitest` (+ de 750 tests) |
| QA-2 | Tests de bout en bout (E2E) | ⏳ | À implémenter |
| QA-3 | Code source public sur GitHub | ✅ | En place via Actions GitHub |
| QA-4 | Documentation technique explicative | ✅ | Dossier `docs/` et `AGENTS.md` |

*(Légende : ✅ Terminé / ⏳ À faire ou en cours)*
