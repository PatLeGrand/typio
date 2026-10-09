# Matrice des exigences

Lien entre les exigences du [cahier des charges](cahier-des-charges.md) et leur état dans la
branche `develop`, au 9 octobre 2026 (tranche B de l'étape 3 incluse). À mettre à jour à chaque fusion dans `develop`.

Légende : ✅ fait · 🟡 partiel · ⏳ à faire. La priorité vient du cahier des charges
(E = essentiel, S = souhaitable, M = moins prioritaire).

## Authentification (AUTH)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| AUTH-1 | Connexion par identifiant et mot de passe | E | ✅ | `src/auth/`, page `/login` |
| AUTH-2 | Connexion via Discord | S | ✅ | `src/auth/oauth/` |
| AUTH-3 | Connexion via GitHub | S | ✅ | `src/auth/oauth/` |
| AUTH-4 | Accès en invité avec un pseudo | E | ✅ | page `/guest` |
| AUTH-5 | Mots de passe hachés | E | ✅ | argon2, `src/auth/password.ts` |
| AUTH-6 | Aucune récupération de mot de passe | M | ✅ | Aucun parcours de récupération |

## Salles (SALLE)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| SALLE-1 | Un membre crée une course et en devient l'hôte | E | ✅ | `room:create`, `src/realtime/roomStore.ts` (PR #40) |
| SALLE-2 | Visibilité publique, semi-publique ou privée | E | ⏳ | Toute salle est accessible par code |
| SALLE-3 | Liste des courses publiques | E | ⏳ | — |
| SALLE-4 | Accès par code et par code QR | E | 🟡 | Code fait (H-5, `src/realtime/roomCode.ts`) ; QR à faire |
| SALLE-5 | Course privée par lien à usage unique | S | ⏳ | — |
| SALLE-6 | Bouton « Partie rapide » | S | ⏳ | — |
| SALLE-7 | Rejoindre comme coureur ou spectateur | E | ✅ | `room:join` avec `role` |
| SALLE-8 | Au moins 2 coureurs, bots compris | E | ⏳ | Pas encore de lancement de course multijoueur |
| SALLE-9 | L'hôte retire un participant | S | ⏳ | — |
| SALLE-10 | Configuration visible en temps réel en salle d'attente | S | ✅ | `room:updateConfig`, diffusion de `room:state` |
| SALLE-11 | Courses en équipes | M | ⏳ | — |
| SALLE-12 | Un invité rejoint mais ne crée pas | E | ✅ | Refus `GUEST_CANNOT_CREATE` |
| SALLE-13 | Hôte brièvement déconnecté : il garde sa place | E | 🟡 | Délai de grâce de 60 s (H-9, `graceTimers.ts`) ; le blocage du lancement attend la course multijoueur |
| SALLE-14 | L'hôte désigne un nouvel hôte avant de partir | E | ⏳ | Aucune commande de désignation dans le protocole |
| SALLE-15 | Sans désignation, le plus ancien devient hôte | E | ✅ | `roomStore.ts`, tri par `joinedAt` |

## Configuration (CONFIG)

Les mêmes réglages servent à la course solo et à la salle d'attente : l'hôte les modifie, les
autres participants les voient changer en direct (étape 3, tranche B). La course multijoueur
qui les appliquera est la tranche C.

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| CONFIG-1 | Mode phrase ou mode mots | E | ✅ | Page de paramètres et salle d'attente (`RaceSettingsFields`) ; appliqué en solo (`src/race/textGenerator.ts`) |
| CONFIG-2 | Langue du texte | E | ✅ | Idem |
| CONFIG-3 | Mots avec accents | S | ✅ | Idem |
| CONFIG-4 | Longueur du texte | E | ✅ | Idem |
| CONFIG-5 | Caractères exclus | S | ✅ | Idem ; liste normalisée par le protocole (`normalizeExcludedCharacters`) |
| CONFIG-6 | Limite de temps optionnelle | S | ✅ | Idem ; 5 min par défaut (H-9) |
| CONFIG-7 | Mode libre ou bloquant | S | ✅ | Idem ; appliqué en solo (`src/race/session.ts`) |
| CONFIG-8 | Bots avec niveau de difficulté | S | ✅ | Idem ; les bots comptent dans les 20 coureurs d'une salle (H-3) |
| CONFIG-9 | Capacités activées ou non | M | ⏳ | Interrupteur présent, sans effet |

## Texte et course (TEXTE, COURSE)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| TEXTE-1 | Texte généré par algorithme | E | ✅ | `src/race/textGenerator.ts` (H-10), tiré au hasard à chaque course |
| TEXTE-2 | Texte conforme à la langue, longueur, accents, exclusions | E | ✅ | `src/race/textGenerator.ts` (H-11), message traduit si les filtres ne laissent rien |
| TEXTE-3 | Même texte pour tous les coureurs | E | ⏳ | Attend la course multijoueur |
| COURSE-1 | Départ commun après compte à rebours | E | ⏳ | Attend la course multijoueur |
| COURSE-2 | Classement en temps réel sur chaque écran | E | ⏳ | Attend la course multijoueur |
| COURSE-3 | Fin quand tous ont fini ou à la limite de temps | E | 🟡 | Course solo : fin du texte, limite de temps ou abandon ; multijoueur à faire |
| COURSE-4 | Reprise après déconnexion | S | ⏳ | — |
| COURSE-5 | Abandon volontaire | S | 🟡 | Course solo ; multijoueur à faire |
| COURSE-6 | Retrait d'un coureur inactif (AFK) | S | ⏳ | — |
| COURSE-7 | Copier-coller bloqué | E | ✅ | `RaceTypingPanel.tsx` (coller et déposer bloqués) |
| COURSE-8 | Progression validée par le serveur | E | ⏳ | Attend la course multijoueur |

## Bots et capacités (BOT, CAPA)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| BOT-1 | Plusieurs niveaux de difficulté | S | ✅ | Facile 25, normale 40, difficile 60 MPM (`src/race/bots.ts`) |
| BOT-2 | Bots au comportement humain | S | ✅ | Vitesse variable, pauses, erreurs corrigées (`src/race/bots.ts`) |
| BOT-3 | Un élève seul joue contre des bots | S | ✅ | Course solo complète, ouverte aux invités |
| CAPA-1 à CAPA-6 | Personnages, capacités, énergie, rattrapage, déblocage | M | ⏳ | — |

## Résultats et statistiques (RES, STATS)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| RES-1 | Page de résultats avec podium | E | 🟡 | Course solo (`RaceResults.tsx`) ; multijoueur à faire |
| RES-2 | MPM, précision, temps et rang | E | 🟡 | Course solo ; multijoueur à faire |
| RES-3 | Heatmap des touches ratées | M | ⏳ | — |
| RES-4 | Relancer ou terminer la session | S | ⏳ | — |
| STATS-1 | Page de statistiques personnelles | S | ⏳ | Page profil sans vraies statistiques |
| STATS-2 | Historique des courses | S | ⏳ | — |
| STATS-3 | Graphique de progression | S | ⏳ | — |
| STATS-4 | Heatmap cumulative | M | ⏳ | — |

## Interface (UI)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| UI-1 | Nom et logo | S | ✅ | `Logo.tsx`, direction artistique Figma |
| UI-2 | Style professionnel et ludique | S | ✅ | Direction artistique Figma |
| UI-3 | Thème clair et sombre | S | ✅ | `src/theme/`, `ThemeToggle.tsx` |
| UI-4 | Site responsive | E | ✅ | Classes responsives Tailwind |
| UI-5 | Français et anglais | E | ✅ | `src/i18n/`, `LanguageSwitcher.tsx` |

## Technique (TECH)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| TECH-1 | Next.js (React) avec TypeScript | E | ✅ | Next 16, React 19, TypeScript 5 |
| TECH-2 | Tailwind CSS | E | ✅ | Tailwind 4 |
| TECH-3 | PostgreSQL | E | ✅ | Drizzle, migrations, PostgreSQL partagé du VPS |
| TECH-4 | Temps réel par WebSockets | E | ✅ | Service `realtime` Socket.IO (ADR-001, PR #40), en production derrière Caddy |
| TECH-5 | HTTPS obligatoire | E | ✅ | Caddy sur le VPS |
| TECH-6 | Services gratuits autant que possible | S | ✅ | VPS existant, aucun service payant ajouté (ADR-001) |

## Qualité (QA)

| ID | Exigence | Prio. | État | Preuve ou manque |
|:---|:---|:---:|:---:|:---|
| QA-1 | Tests unitaires | S | ✅ | Vitest, lancés par la CI (`.github/workflows/ci.yml`) |
| QA-2 | Tests de bout en bout | S | ⏳ | — |
| QA-3 | Code source public sur GitHub | E | ✅ | Dépôt public, CI GitHub Actions |
| QA-4 | Documentation des choix techniques | S | ✅ | `docs/architecture/` (ADR, machine à états, modèle de données) |
