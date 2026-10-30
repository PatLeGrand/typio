# Exigences et matrice de traçabilité

Le référentiel est l'énoncé final du travail de session : [enonce.md](enonce.md) (le PDF fait foi).
Chaque exigence y porte un identifiant (`COURSE-04`, `SALLE-02`…) repris ici.
L'ancien cahier des charges ([cahier-des-charges.md](cahier-des-charges.md)) a une autre numérotation :
la section « Correspondance avec l'ancien cahier des charges » relie les deux, sans rien perdre.

Légende des statuts : **complet** / **partiel** / **non fait**.
L'énoncé pénalise une fausse déclaration « complet » plus qu'un « partiel » honnête.
En cas de doute, le statut est « partiel » ou « non fait ». Un « complet » cite toujours un fichier de preuve.

État au 29 octobre 2026, d'après le code de la branche `feat/public-rooms` (salles publiques, explorateur et partie rapide).

Les fichiers cités sont relatifs à la racine du dépôt. Les tests sont lancés par `bun run test`.

## Contraintes techniques (TECH)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TECH-01 | complet | `package.json`, `src/app/[lang]/` | `src/app/[lang]/layout.test.tsx` | Next.js. Next 16.3.8, App Router, React 19. |
| TECH-02 | partiel | `tsconfig.json`, `eslint.config.mjs` | — | TypeScript. `strict: true` et aucun `any`, `@ts-ignore` ni `@ts-expect-error` dans `src/`. Écarts : deux fichiers `.mjs` (`eslint.config.mjs`, `postcss.config.mjs`) et `@typescript-eslint/no-explicit-any` pas réglé explicitement en erreur (il vient du préréglage `eslint-config-next/typescript`, à vérifier). `.claude/scripts/delegate.mjs` exclu : outillage des agents IA, pas du code de l'application (choix documenté). `allowJs: true` dans `tsconfig.json`. |
| TECH-03 | complet | `postcss.config.mjs`, `src/app/globals.css` | `src/theme/noHardcodedColors.test.ts` | Tailwind CSS 4, couleurs passées par des variables CSS. |
| TECH-04 | partiel | `src/db/schema.ts`, `drizzle/0000_short_gateway.sql` à `0003_flippant_bloodstorm.sql`, `scripts/migrate.ts` | `src/auth/repositories.integration.test.ts`, `src/race/drizzleRaceRepository.integration.test.ts` | PostgreSQL via Drizzle, migrations versionnées : `users`, `sessions`, `oauth_accounts`, `races`, `race_results`. Manque : script de seed (corpus, utilisateurs, historique) ; les textes restent dans le code (CONF-03). |
| TECH-05 | complet | `Dockerfile`, `infra/docker-compose.yml`, `.github/workflows/image.yml` | — | Déploiement sur le VPS, HTTPS par Caddy, https://typio.aether-manager.ca. Dernière version vérifiée en production : 9 octobre 2026 (`sha-994ac37`). À revérifier avant chaque remise. |
| TECH-06 | complet | `src/realtime/` (`server.ts`, `roomHandlers.ts`, `protocol.ts`, `raceEngine.ts`) | `src/realtime/server.test.ts`, `roomHandlers.test.ts`, `raceHandlers.test.ts` | Socket.IO (ADR-001), service séparé derrière Caddy : salle et progression des participants pendant la course. |
| TECH-07 | complet | `src/realtime/protocol.ts` (`roomConfigPatchSchema`, `createPayloadSchema`, `joinPayloadSchema`, `raceCommandSchema`, `raceInputSchema`), `src/auth/validation.ts`, `src/auth/formData.ts`, `src/auth/actions.ts`, `src/app/[lang]/(site)/profile/actions.ts`, `src/profile/profileSettings.ts`, `src/auth/oauth/callbackQuery.ts`, `src/auth/oauth/providers.ts`, `src/race/config.ts`, `src/race/raceHistory.ts` | `src/realtime/protocol.test.ts`, `src/auth/validation.test.ts`, `src/auth/oauth/callbackQuery.test.ts`, `src/race/config.test.ts`, `src/race/raceHistory.test.ts` | Toute entrée serveur passe par un schéma Zod 4 : messages temps réel (objet simple, clés inconnues refusées), champs et formulaires des actions serveur, paramètre `provider` et query du callback OAuth (2048 caractères au plus), numéro de page et identifiant de course, réglages de course (H-27). Comportement inchangé : signatures et tests existants conservés. |
| TECH-08 | complet | `infra/docker-compose.yml` | — | VPS déjà payé, aucun service externe payant (ADR-001). Pas de stockage d'images (AUTH-04 non fait). |
| TECH-09 | complet | `.github/workflows/ci.yml`, `package.json` (`typecheck`) | — | GitHub Actions déclenchée sur chaque *push* (toutes les branches) et sur les PR vers `develop` et `main` : vérification de types séparée (`tsc --noEmit`), tests unitaires, lint, build, build temps réel, migrations, test d'intégration PostgreSQL. |
| TECH-10 | complet | `.env.example`, `infra/.env.example` | — | Aucun secret commité. `.env.example` documente toutes les variables lues par `src/` et `scripts/` (`DATABASE_URL`, `APP_ORIGIN`, OAuth, `NEXT_PUBLIC_REALTIME_URL`, `REALTIME_PORT`, `HOSTNAME`). |

## Identité visuelle et design (DES)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| DES-01 | partiel | `docs/DEMARCHE-CREATIVE.md`, `src/components/Logo.tsx` | `src/components/Logo.test.tsx` | Nom du site : Typio. Reste à écrire la liste des noms envisagés, la raison du choix et la vérification d'originalité dans `docs/DEMARCHE-CREATIVE.md`. |
| DES-02 | partiel | `src/components/Logo.tsx`, `src/app/favicon.ico`, `public/images/mascotte-poulpe.png` | `src/components/Logo.test.tsx` | Logo utilisé dans l'application et comme favicon. Croquis papier ou tablette pas encore joints à la démarche créative. |
| DES-03 | partiel | `docs/design/`, `docs/DEMARCHE-CREATIVE.md`, `src/app/globals.css` | — | Direction artistique faite dans Figma, palette et typographies en tokens CSS. Moodboard de 3 à 5 références à joindre à la démarche. |
| DES-04 | partiel | `src/components/race/RaceVisualizer.tsx`, `public/race/` | — | Piste de progression dessinée (PixiJS) : élément signature. Design propre mais pas vérifié contre la liste des signes « généré par défaut » (icônes `lucide-react`, mise en page de l'accueil). |
| DES-05 | complet | `src/theme/`, `src/components/ThemeToggle.tsx`, `src/theme/themeScript.ts` | `src/theme/theme.test.ts`, `themeScript.test.ts`, `themeStore.test.ts`, `src/components/ThemeToggle.test.tsx` | Sélecteur, préférence système par défaut, script de thème avant l'affichage (pas de flash). |
| DES-06 | partiel | classes Tailwind responsives, `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | — | En salle, la zone de frappe est remplacée par un message « clavier physique recommandé » sous 768 px ou avec un pointeur tactile. Vérifié à 375 et 360 px sans défilement horizontal (salle de course). Manque : ce message pour la course solo. |

## Comptes et profil (AUTH)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| AUTH-01 | complet | `src/auth/authFlows.ts`, `src/auth/oauth/`, `src/app/api/auth/[provider]/`, `src/app/[lang]/(auth)/login/` | `src/auth/authFlows.test.ts`, `src/auth/oauth/*.test.ts`, `src/app/api/auth/[provider]/route.test.ts` | Authentification. Discord, GitHub (bibliothèque `arctic`) et identifiant + mot de passe, y compris en production. Sessions maison (ADR-001). |
| AUTH-02 | partiel | `src/auth/validation.ts`, `src/auth/authFlows.ts`, `src/auth/session.ts`, `src/app/[lang]/(auth)/guest/` | `src/auth/validation.test.ts`, `src/auth/session.test.ts` | Pseudonyme d'invité. Écart : minimum 2 caractères (`PSEUDO_MIN_LENGTH`) au lieu de 3 ; maximum 20 respecté. Le cookie `__Host-typio_session` porte un jeton opaque dont seul le hachage est stocké (équivalent à un cookie signé). Session d'invité de 24 h. |
| AUTH-03 | partiel | `src/realtime/roomStore.ts` (`GUEST_CANNOT_CREATE`), `src/auth/purge.ts` | `src/realtime/roomStore.test.ts`, `src/auth/purge.test.ts` | Un invité ne peut pas créer de salle ; ses données sont purgées avec sa session. Manque : l'avatar généré à la place de la photo (aucun avatar n'est affiché). |
| AUTH-04 | non fait | — | — | Photo de profil : ni téléversement, ni redimensionnement, ni stockage. L'avatar OAuth n'est volontairement pas conservé (données minimales, public de 12 à 17 ans). |
| AUTH-05 | complet | `src/app/[lang]/(site)/profile/actions.ts`, `ProfileForm.tsx`, `src/auth/validation.ts` | `src/app/[lang]/(site)/profile/actions.test.ts`, `ProfileForm.test.tsx` | Modification du pseudonyme d'affichage, avec protection contre les homoglyphes. |
| AUTH-06 | complet | `src/app/[lang]/(site)/profile/page.tsx`, `src/components/profile/ProfileStats.tsx`, `src/race/drizzleProfileStatsRepository.ts` | `src/race/raceHistory.integration.test.ts` | Section réservée au membre : meilleur MPM, MPM moyen, précision moyenne, nombre de courses et de victoires (agrégat SQL), courbe SVG du MPM des 50 dernières courses non abandonnées, dates localisées. Règles de calcul : H-26. Vérifié dans l'application le 29 octobre 2026 (agrégats recoupés avec la base, FR/EN, clair/sombre, 360 px). |

## Salles et visibilité (SALLE)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SALLE-01 | complet | `src/realtime/roomStore.ts` (`create`), `src/realtime/protocol.ts` (`parseCreatePayload`), `src/realtime/roomHandlers.ts`, `src/app/[lang]/(site)/race/settings/InviteFriendsButton.tsx` | `src/realtime/roomStore.test.ts`, `protocol.test.ts`, `roomHandlers.test.ts`, `InviteFriendsButton.test.tsx` | Création par un membre, qui devient hôte. L'hôte choisit d'être coureur (par défaut) ou seulement spectateur ; le rôle est validé par le serveur (`room:create` reçoit `{ config, role }`). |
| SALLE-02 | complet | `src/realtime/roomCode.ts` | `src/realtime/roomCode.test.ts` | Code de 6 caractères sans `0`, `O`, `1`, `I`, `L`, tiré par `crypto.getRandomValues` ; unique parmi les salles ouvertes (H-5). |
| SALLE-03 | partiel | `src/realtime/protocol.ts` (`ROOM_VISIBILITIES`), `src/realtime/roomStore.ts` (`join`), `src/realtime/lobby.ts`, `src/components/race/RaceSettingsFields.tsx` | `src/realtime/roomStore.test.ts`, `src/realtime/lobby.test.ts`, `src/realtime/lobbyHandlers.test.ts` | Visibilité publique, sur code (défaut, H-29) ou privée, réglée par l'hôte et validée par le serveur. Publique : listée et rejoignable directement. Sur code : non listée. Privée : non listée, code seul refusé (`INVITE_REQUIRED`), reconnexion d'un membre déjà présent acceptée. Manque : les liens d'invitation (SALLE-04), donc personne ne peut encore entrer dans une salle privée. |
| SALLE-04 | non fait | — | — | Aucun lien d'invitation (jeton, usage unique, liaison à l'IP, révocation). Le bouton « Inviter des amis » de `race/settings/InviteFriendsButton.tsx` ouvre une salle ; il ne génère pas de lien. |
| SALLE-05 | complet | `src/realtime/protocol.ts` (`capacity`, `MIN_CAPACITY`, `MAX_CAPACITY`), `src/realtime/roomStore.ts` | `src/realtime/roomStore.test.ts` | Capacité de 2 à 30 (défaut 20) réglée par l'hôte ; elle compte coureurs humains et bots, pas les spectateurs (H-28). Capacité inférieure aux coureurs présents ou bots en trop : `ROOM_FULL`. Vérifié dans l'application le 29 octobre 2026. |
| SALLE-06 | partiel | `src/realtime/roomStore.ts` (`roomByUser`), `src/app/[lang]/(site)/play/InRoomNotice.tsx` | `src/realtime/roomStore.test.ts` | Une personne n'est que dans une salle, garanti par le serveur ; un deuxième onglet ne crée pas de doublon ; l'interface propose de quitter la salle actuelle. Écart : l'index est en mémoire, pas une contrainte en base de données. |
| SALLE-07 | non fait | — | — | Aucune commande d'expulsion dans le protocole. |
| SALLE-08 | partiel | `src/realtime/roomStore.ts` (`removeParticipant`) | `src/realtime/roomStore.test.ts` | Le plus ancien participant connecté devient hôte ; salle fermée quand plus personne. Écarts : s'il ne reste que des déconnectés, le plus ancien d'entre eux hérite du rôle au lieu de fermer la salle ; un invité peut hériter (choix à confirmer, voir « à trancher »). |
| SALLE-09 | complet | `src/realtime/roomStore.ts` (`join`) | `src/realtime/raceHandlers.test.ts` | Rejoindre est refusé en décompte et en course (`RACE_IN_PROGRESS`), permis en attente et aux résultats (H-23). |
| SALLE-10 | partiel | `src/realtime/roomHandlers.ts`, `src/realtime/server.ts` (`JOIN_FAILURE_LIMIT`) | `src/realtime/roomHandlers.test.ts` | Limite de 10 échecs par minute sur `room:join`. Écart : comptée par utilisateur (session), pas par adresse IP. |

## Rejoindre une course (JOIN)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| JOIN-01 | complet | `src/components/home/HomeJoinCodeForm.tsx`, `src/components/home/HomeHero.tsx`, `src/app/[lang]/(site)/play/JoinRoomForm.tsx` | `src/app/[lang]/(site)/page.test.tsx`, `play/JoinRoomForm.test.tsx` | Champ « code de la salle » sur la page d'accueil, qui ouvre la salle ; aussi sur `/play` avec le choix du rôle. Un visiteur non connecté passe par la connexion et doit ressaisir le code ensuite. |
| JOIN-02 | partiel | `src/realtime/lobby.ts`, `src/realtime/roomHandlers.ts` (`lobby:subscribe`), `src/realtime/server.ts` (`LOBBY_BROADCAST_MS`), `src/app/[lang]/(site)/play/RoomExplorer.tsx` | `src/realtime/lobby.test.ts`, `src/realtime/lobbyHandlers.test.ts` | Liste des salles publiques (100 au plus) avec coureurs et capacité, langue, hôte et état, mise à jour en direct (diffusion regroupée toutes les 500 ms au plus) ; filtre par langue ; salles pleines ou en course affichées comme indisponibles (H-30). Manque : la complexité et son filtre (CONF-05 non fait). Vérifié dans l'application le 29 octobre 2026 (FR/EN, clair/sombre, 360 px). |
| JOIN-03 | complet | `src/realtime/lobby.ts` (`pickQuickJoin`), `src/realtime/roomStore.ts` (`quickJoinCode`), `src/realtime/roomHandlers.ts` (`room:quickJoin`), `src/app/[lang]/(site)/play/QuickJoinPanel.tsx` | `src/realtime/lobby.test.ts`, `src/realtime/lobbyHandlers.test.ts` | Salle publique joignable et non pleine avec le moins de places restantes, égalité → la plus ancienne. Aucune salle : `NO_ROOM_AVAILABLE` ; un membre peut créer une salle publique avec la config par défaut, un invité voit un état vide. Vérifié dans l'application le 29 octobre 2026. |

## Configuration de la course (CONF)

Les mêmes réglages servent à la course solo (`src/race/config.ts`) et à la salle d'attente (`RoomConfig`).

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| CONF-01 | partiel | `src/realtime/protocol.ts` (`TIME_LIMITS_SECONDS`), `src/race/config.ts` | `src/race/config.test.ts`, `src/realtime/protocol.test.ts` | Temps maximal : 1, 2, 3, 5 ou 10 minutes. Écarts : pas de 30 s ; « aucun » devient un plafond de 5 minutes (H-9). |
| CONF-02 | complet | `src/realtime/protocol.ts` (`TEXT_LANGUAGES`), `src/components/race/RaceSettingsFields.tsx` | `src/realtime/protocol.test.ts`, `src/race/textGenerator.test.ts` | Langue du texte, français ou anglais, indépendante de la langue de l'interface. |
| CONF-03 | partiel | `src/race/textGenerator.ts`, `src/race/data/` | `src/race/textGenerator.test.ts` | Type de texte : phrases (cohérent) et mots (aléatoire). Écart : les phrases et les mots sont dans le code (`src/race/data/*.ts`), pas dans un corpus en base de données. |
| CONF-04 | partiel | `src/race/textGenerator.ts` (`TEXT_TARGET_LENGTH`) | `src/race/textGenerator.test.ts` | Longueur : court, moyen, long (100, 200, 350 caractères visés), pas un nombre de mots. |
| CONF-05 | non fait | — | — | Pas de réglage de complexité (facile, moyen, difficile) ni de critères mesurables. Voir « à trancher ». |
| CONF-06 | partiel | `src/race/textGenerator.ts`, `src/components/race/RaceSettingsFields.tsx` | `src/race/textGenerator.test.ts` | Seule l'option « accents » existe. Manquent : ponctuation, nombres, majuscules. |
| CONF-07 | partiel | `src/realtime/protocol.ts` (`normalizeExcludedCharacters`), `src/race/textGenerator.ts` | `src/realtime/protocol.test.ts`, `src/race/textGenerator.test.ts` | Caractères à exclure (liste normalisée, 30 au plus). En mode phrase, les phrases contenant un caractère exclu sont écartées (H-11). Manque : l'inclusion de caractères. |
| CONF-08 | complet | `src/race/metrics.ts` (`applyTypedInput`), `src/realtime/raceEngine.ts` | `src/race/metrics.test.ts`, `src/realtime/raceEngine.test.ts` | Mode libre et mode bloquant appliqués en solo et par le serveur en salle. |
| CONF-09 | non fait | — | — | Pas de bonus de remontée. L'interrupteur « capacités » de `RaceSettings` est sans effet. |
| CONF-10 | partiel | `src/realtime/protocol.ts` (`botCount`, `botDifficulty`, `MAX_BOTS`), `src/race/bots.ts` | `src/race/bots.test.ts`, `src/realtime/protocol.test.ts` | Ajout et retrait de bots (0 à 7). Écarts : un seul niveau pour tous les bots, trois niveaux au lieu de cinq ; bots joués en solo seulement. |
| CONF-11 | partiel | `src/realtime/protocol.ts`, `src/components/race/RaceSettingsFields.tsx` | `src/realtime/roomStore.test.ts` | Visibilité et capacité réglables par l'hôte (SALLE-05 complet). Partiel tant que la visibilité privée n'a pas de liens d'invitation (SALLE-03, SALLE-04). |
| CONF-12 | complet | `src/realtime/roomHandlers.ts` (`room:updateConfig`), `src/app/[lang]/(site)/room/_components/RoomConfigPanel.tsx` | `src/realtime/roomHandlers.test.ts`, `src/app/[lang]/(site)/room/_components/RoomConfigPanel.test.tsx` | Chaque changement de l'hôte est diffusé à toute la salle (`room:state`) ; seul l'hôte peut modifier, en attente seulement. |

## Déroulement d'une course (COURSE)

Seule la course solo contre des bots existe (`src/race/`, `src/components/race/`). Les lignes ci-dessous disent ce que la course solo couvre.

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| COURSE-01 | complet | `src/realtime/protocol.ts` (`RoomStatus`), `src/realtime/raceEngine.ts`, `src/realtime/roomStore.ts`, `docs/ARCHITECTURE.md` | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | La salle parcourt `waiting` → `countdown` → `racing` → `results` → `waiting` ou `closed`, côté serveur temps réel. |
| COURSE-02 | complet | `src/realtime/raceEngine.ts` (`startRace`), `src/realtime/roomHandlers.ts` (`race:start`) | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | Hôte connecté seulement ; au moins 2 coureurs dont 1 humain, bots compris, spectateurs exclus (`NOT_ENOUGH_RUNNERS`). |
| COURSE-03 | complet | `src/realtime/raceEngine.ts` (`startAt`, `serverNow`), `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | `src/realtime/raceEngine.test.ts` | Texte généré et diffusé au début du décompte de 3 s ; le client cale le décompte sur l'heure du serveur. Vérifié dans l'application (QA du 28 octobre 2026, FR et EN, clair et sombre). |
| COURSE-04 | complet | `src/components/race/RaceTypingPanel.tsx`, `src/realtime/raceInput.ts`, `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | `src/realtime/raceInput.test.ts` | En salle : saisie optimiste rejouée avec les règles du serveur, MPM et précision en direct, coller bloqué. Vérifié dans l'application (QA du 28 octobre 2026, FR et EN, clair et sombre). |
| COURSE-05 | partiel | `src/components/race/RaceVisualizer.tsx`, `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | — | Piste alimentée par le serveur (10 instantanés/s) avec humains et bots, nom, position, MPM, joueur local mis en évidence ; spectateurs sans zone de frappe. Manquent : les avatars. Vérifié dans l'application. |
| COURSE-06 | partiel | `src/realtime/raceEngine.ts` (`applyInput`), `src/realtime/roomHandlers.ts` (`race:input`), `src/realtime/protocol.ts` (`parseRaceInput`) | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | Le serveur fixe départ et fin, rejoue les frappes (au plus 64 par lot), refuse une cadence au-delà de 25 frappes/s + 15 (H-20) et calcule progression et classement. Manque : l'application des bonus (BONUS-01 à 04 non faits). |
| COURSE-07 | partiel | `src/realtime/raceEngine.ts` (`abandonRace`), `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | Abandon en salle avec confirmation en deux temps (en solo, pas encore de confirmation). Vérifié dans l'application (QA du 28 octobre 2026, FR et EN, clair et sombre). |
| COURSE-08 | complet | `src/realtime/protocol.ts` (`RECONNECT_GRACE_MS` = 30 s), `src/realtime/roomStore.ts`, `src/realtime/roomHandlers.ts` (`race:self`) | `src/realtime/raceHandlers.test.ts`, `graceTimers.test.ts` | Grâce de 30 s ; le coureur reprend sa saisie (`race:self`) ; passé le délai, abandon. Vérifié dans l'application (QA du 28 octobre 2026, FR et EN, clair et sombre). |
| COURSE-09 | complet | `src/realtime/raceEngine.ts` (`tickRace`) | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | Fin quand plus aucun coureur actif (déconnecté compris) ou à la limite de temps. |
| COURSE-10 | complet | `src/realtime/raceEngine.ts` (`raceResults`), `src/race/results.ts` (solo) | `src/realtime/raceEngine.test.ts`, `raceStore.test.ts`, `raceHandlers.test.ts` | Arrivés par temps, puis non arrivés par progression, puis abandons par progression au moment de l'abandon. |
| COURSE-11 | complet | `src/realtime/roomStore.ts` (`finish`), `src/realtime/roomHandlers.ts` (`room:restart`, `room:close`), `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx` | `src/realtime/raceHandlers.test.ts` | L'hôte relance (mêmes participants, configuration modifiable) ou ferme la salle ; les autres restent ou quittent. Vérifié dans l'application (QA du 28 octobre 2026, FR et EN, clair et sombre). |

## Bots (BOT)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BOT-01 | partiel | `src/race/bots.ts` (`BOT_TARGET_WPM`) | `src/race/bots.test.ts` | Trois niveaux au lieu de cinq : facile 25, normal 40, difficile 60 MPM. Aucun niveau Expert ni Impossible ; les taux d'erreur ne sont pas calibrés par niveau (3 % de fautes par mot pour tous). Valeurs à documenter. |
| BOT-02 | partiel | `src/race/bots.ts` (`planBot`) | `src/race/bots.test.ts` | Vitesse variable par mot (±20 %), pauses aléatoires. Manque : ralentissement sur les mots difficiles (`src/race/bots.ts` ne tient pas compte de la difficulté du mot). |
| BOT-03 | partiel | `src/race/bots.ts` | `src/race/bots.test.ts` | Les bots font des fautes qu'ils corrigent (temps perdu). Ils ne tiennent pas compte du mode d'erreur configuré. |
| BOT-04 | partiel | `src/components/race/RaceVisualizer.tsx`, `src/i18n/dictionaries/` | — | Noms de bots dédiés. Identification claire dans l'interface et soumission aux bonus à vérifier (pas de bonus). |
| BOT-05 | complet | `src/race/bots.ts`, `src/race/seededRandom.ts`, `src/realtime/raceEngine.ts` | `src/race/bots.test.ts`, `src/realtime/raceEngine.test.ts` | En salle, le serveur tire une graine par course ; texte, noms et plans des bots en découlent, donc une même graine rejoue les mêmes bots. En solo, la graine n'est toujours pas fixée. |

## Bonus de remontée (BONUS)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BONUS-01 | non fait | — | — | Règle exacte à documenter, voir « à trancher ». |
| BONUS-02 | non fait | — | — | Aucun type de bonus. |
| BONUS-03 | non fait | — | — | — |
| BONUS-04 | non fait | `src/race/metrics.ts` | `src/race/metrics.test.ts` | Le calcul de progression et de MPM suit l'annexe A mais ne gère pas de texte modifié en cours de course. |

## Résultats et statistiques (RES)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| RES-01 | partiel | `src/components/race/RaceResults.tsx` | `src/components/race/RaceScreen.test.tsx` | Podium des 3 premiers, en solo seulement. |
| RES-02 | partiel | `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx`, `src/components/race/RaceResults.tsx` | `src/realtime/raceEngine.test.ts` | En salle : rang, nom, MPM net et brut, précision, erreurs, temps, statut. Manquent : les bonus reçus. Vérifié dans l'application. |
| RES-03 | non fait | — | — | Aucun graphique. |
| RES-04 | complet | `src/db/schema.ts` (`personal_best`), `drizzle/0004_thankful_supernaut.sql`, `src/race/drizzleRaceRepository.ts`, `src/realtime/server.ts` (`race:records`), `src/app/[lang]/(site)/room/_components/RoomRaceView.tsx`, `src/components/race/RaceResultsTable.tsx` | `src/race/drizzleRaceRepository.integration.test.ts`, `src/realtime/racePersistence.test.ts` | Record calculé à l'enregistrement de la course (H-26) : message « Nouveau record personnel ! » au joueur, badge dans le tableau des résultats et dans l'historique. Membres seulement (H-24). Vérifié dans l'application le 29 octobre 2026 : record à 111 MPM signalé en salle, historique et détail ; badge remis à zéro à la course suivante. |
| RES-05 | complet | `src/db/schema.ts` (`races`, `race_results`), `drizzle/0003_flippant_bloodstorm.sql`, `src/race/drizzleRaceRepository.ts`, `src/realtime/raceEngine.ts` (`wpmSeries`), `src/realtime/server.ts` | `src/race/drizzleRaceRepository.integration.test.ts`, `src/realtime/racePersistence.test.ts`, `raceEngine.test.ts` | Une écriture par course, en une transaction, au passage aux résultats (aussi si la salle se vide pendant la course) : rang, statut, MPM net et brut, précision, erreurs, temps, progression et série du MPM (une valeur par seconde). Membres seulement (H-24). Vérifié dans l'application avec une base locale. |

## Historique (HIST)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| HIST-01 | complet | `src/app/[lang]/(site)/history/page.tsx`, `src/race/drizzleRaceHistoryRepository.ts` (`listUserRaces`), `src/race/raceHistory.ts`, lien dans `src/components/ProfileModal.tsx` et la page profil | `src/race/raceHistory.test.ts`, `src/race/raceHistory.integration.test.ts`, `src/app/[lang]/(site)/history/page.test.tsx` | Chaque course enregistrée (RES-05) du membre, de la plus récente à la plus ancienne (`race_results_user_created_at_idx`), 20 par page, navigation précédent/suivant : date, rang sur le nombre de classés, MPM, précision, statut. Visiteur redirigé vers la connexion, invité vers l'inscription (H-25). Vérifié dans l'application avec 23 courses en base (FR/EN, clair/sombre, 360 px). |
| HIST-02 | complet | `src/app/[lang]/(site)/history/[raceId]/page.tsx`, `src/race/drizzleRaceHistoryRepository.ts` (`getRaceForUser`), `src/components/race/RaceResultsTable.tsx` (partagé avec `RoomRaceView`) | `src/race/raceHistory.integration.test.ts`, `src/race/raceHistory.test.ts` | Le lien de chaque ligne réaffiche le tableau de résultats de la course (rang, nom, MPM net et brut, précision, erreurs, temps, statut), ligne du membre surlignée. Seuls les membres enregistrés y figurent (H-24). Contrôle serveur : 404 si l'identifiant n'est pas un UUID ou si le membre n'a pas couru cette course, sans distinguer une course inexistante. Vérifié dans l'application. |

## Internationalisation (I18N)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| I18N-01 | partiel | `src/i18n/dictionaries/fr.json`, `en.json`, `generateMetadata` des pages | `src/i18n/dictionaries.test.ts` | Dictionnaires FR et EN aux mêmes clés (vérifié par test), messages d'erreur et métadonnées traduits. Pas d'audit exhaustif des chaînes codées en dur dans les composants. |
| I18N-02 | partiel | `src/components/LanguageSwitcher.tsx`, `src/proxy.ts`, `src/i18n/negotiate.ts` | `src/proxy.test.ts`, `src/i18n/negotiate.test.ts`, `src/components/LanguageSwitcher.test.tsx` | Sélecteur dans l'en-tête, choix conservé en cookie `NEXT_LOCALE`, sinon langue du navigateur, sinon français. Manque : sélecteur sur la page de course `src/app/[lang]/race/page.tsx` (hors du layout `(site)`, sans `SiteHeader`). |
| I18N-03 | partiel | `src/race/format.ts`, `src/app/[lang]/(site)/profile/ProfileForm.tsx` | `src/race/format.test.ts` | `Intl` sert aux dates du profil et aux pluriels. Pas de formatage systématique des nombres (MPM, temps) selon la langue. |

## Tests (TEST)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TEST-01 | complet | `vitest.config.mts`, `src/**/*.test.ts(x)` | tout `src/` | Vitest, 115 fichiers de test, lancés par la CI. Test d'intégration PostgreSQL séparé (`src/auth/repositories.integration.test.ts`). |
| TEST-02 | non fait | — | — | Pas de Playwright. |
| TEST-03 | partiel | `src/auth/authFlows.ts` | — | La connexion par identifiant et mot de passe existe (AUTH-01) ; aucun test de bout en bout ne l'utilise encore. |

## Performance (PERF)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| PERF-01 | non fait | — | — | Aucune mesure Lighthouse consignée. |
| PERF-02 | complet | `src/realtime/raceInput.ts`, `src/realtime/server.ts`, `src/realtime/roomHandlers.ts` | `src/realtime/raceInput.test.ts`, `raceHandlers.test.ts` | Le client regroupe ses frappes toutes les 100 ms ; le serveur ignore au-delà de 12 messages/s par joueur et diffuse au plus toutes les 100 ms (H-21). Aucune écriture en base pendant la course. |
| PERF-03 | non fait | `src/components/race/RaceVisualizer.tsx` | — | Piste jamais mesurée avec 30 participants. |

## Accessibilité (A11Y)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| A11Y-01 | complet | `src/app/globals.css` (tokens) | `src/theme/contrast.test.ts` | Contraste WCAG calculé par test pour les couples de tokens, dans les deux thèmes. Vérifie les tokens, pas chaque page. |
| A11Y-02 | partiel | `src/components/SiteHeader.tsx`, `src/components/race/RaceResults.tsx`, pages sous `src/app/` | — | `<header>`, `<main>`, `<table>` avec `<caption>` et `<th scope>` en place. Pas d'audit des titres ni de `<nav>`/`<footer>` sur toutes les pages. |
| A11Y-03 | partiel | `src/components/TextField.tsx`, `SelectField.tsx`, `Checkbox.tsx` | `src/components/TextField.test.tsx` | Champs partagés avec libellé. Les images décoratives ont `alt=""` ; pas d'audit complet. |
| A11Y-04 | partiel | `src/app/globals.css` (`:focus-visible`) | — | Indicateur de focus global. Parcours clavier complet non vérifié. |

## Sécurité (SEC)

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SEC-01 | partiel | `src/realtime/roomHandlers.ts`, `src/realtime/roomStore.ts` | `src/realtime/roomHandlers.test.ts` | Configuration réservée à l'hôte, contrôlée côté serveur (`NOT_HOST`). Lancer, liens, expulsion et fermeture n'existent pas encore. |
| SEC-02 | non fait | — | — | Aucun téléversement (AUTH-04). |
| SEC-03 | complet | `src/auth/password.ts` | `src/auth/password.test.ts` | Mots de passe hachés avec Argon2 (`@node-rs/argon2`), jamais stockés ni journalisés en clair. |

## Choix documentés (ambiguïtés, § 2.2 de l'énoncé)

Les hypothèses H-1 à H-18 de l'ancien cahier gardent leur identifiant : le code y fait référence.

| ID | Choix retenu | Statut | Raison ou nouvelle règle |
|---|---|---|---|
| H-1 | Moins de 13 ans : Discord et GitHub offerts, compte identifiant ou invité pour les 12 ans | toujours valable | AUTH-01 permet l'identifiant et le mot de passe. |
| H-2 | Statistiques d'un invité : le temps de la session seulement | toujours valable | AUTH-03 : pas d'historique persistant pour un invité. |
| H-3 | Un bot compte comme coureur | toujours valable | COURSE-02 : les bots comptent dans le minimum de 2 participants. |
| H-4 | Lien d'invitation valable 24 h ou jusqu'au début de la course | révisée par l'énoncé | SALLE-04 : usage unique lié à l'IP, valable jusqu'à la fermeture de la salle, révoqué à l'expulsion. |
| H-5 | Code de 6 caractères majuscules sans `0 O 1 I L` | toujours valable | Identique à SALLE-02. |
| H-6 | Pas de code QR pour une course privée | sans objet | Le code QR n'existe plus dans l'énoncé. |
| H-7 | Courses avec capacités exclues des graphiques | sans objet | Les capacités sont remplacées par les bonus ; BONUS-04 exige un calcul cohérent à la place. |
| H-8 | Classement au pourcentage du texte | révisée par l'énoncé | COURSE-10 : temps d'arrivée, puis progression, puis abandons. La progression suit l'annexe A. |
| H-9 | 60 s de reconnexion, 30 s d'AFK, limite par défaut de 5 min | révisée par l'énoncé | COURSE-08 : reconnexion 30 s (`RECONNECT_GRACE_MS`, H-22). Plus d'AFK : l'abandon couvre le cas. La limite de 5 min tient lieu d'« aucun » (écart avec CONF-01). |
| H-10 | Phrases du domaine public et dictionnaire de fréquence | révisée par l'énoncé | CONF-03 : le mode cohérent lit un corpus stocké en base de données (seed, TECH-04). Écart : banque dans le code. |
| H-11 | Phrase avec caractère exclu : on écarte la phrase | toujours valable | Retenu comme le comportement de CONF-07 en mode cohérent (voir « à trancher »). |
| H-12 | Tablette seulement avec clavier physique | révisée par l'énoncé | DES-06 : à partir de 360 px tout est utilisable, mais la course est remplacée par un message « clavier physique » sur mobile. |
| H-13 | Next.js sur Vercel, Socket.IO et PostgreSQL sur hébergeurs gratuits | révisée par l'énoncé | TECH-05 et ADR-001 : un seul VPS (Docker, Caddy, PostgreSQL partagé). |
| H-14 | Disposition du clavier choisie dans le profil | toujours valable | Sert à la carte de chaleur des touches de RES-03. Le réglage existe déjà (`profileSettings.ts`). |
| H-15 | Pas de clavardage | toujours valable | L'énoncé n'en prévoit pas. |
| H-16 | 20 coureurs par course | révisée par l'énoncé | SALLE-05 : capacité de 2 à 30 choisie par l'hôte, 20 par défaut (`DEFAULT_CAPACITY`). |
| H-17 | Énergie identique pour tous, rattrapage par les capacités | sans objet | Les personnages, capacités et énergie sont remplacés par les bonus de remontée (BONUS-01 à 04). |
| H-18 | Personnages débloqués par le nombre de courses terminées | sans objet | Personnages absents de l'énoncé. |
| H-19 | L'outillage des agents IA (`.claude/`) est hors périmètre de TECH-02 | valable | Ce n'est pas du code de l'application livrée ; l'énoncé (§ 8, `docs/IA.md`) demande de commiter ces fichiers d'instructions d'agent, et ils ne sont ni compilés ni déployés. |
| H-20 | Le client envoie des frappes, pas une position | valable | `race:input` porte au plus 64 opérations (un caractère ou un retour arrière) ; le serveur les rejoue. Cadence refusée au-delà de 25 frappes/s depuis le départ + 15 de rafale (environ 300 MPM) : le lot entier est refusé et le serveur renvoie la saisie de référence (COURSE-06). |
| H-21 | Limites réseau de la course | valable | Le client envoie au plus un lot toutes les 100 ms ; le serveur ignore au-delà de 12 messages/s par joueur et diffuse l'état de la course au plus toutes les 100 ms (PERF-02, COURSE-05). |
| H-22 | Grâce de reconnexion de 30 s | valable | Remplace les 60 s de H-9 pour la salle comme pour la course (COURSE-08). |
| H-23 | Pas d'entrée en spectateur pendant une course | valable | L'architecture d'origine faisait entrer un arrivant en spectateur ; SALLE-09 interdit de rejoindre en décompte ou en course : refus `RACE_IN_PROGRESS`. |
| H-24 | Résultats enregistrés pour les membres seulement | valable | AUTH-03 : un invité n'a pas d'historique persistant. Ni invités ni bots dans `race_results` ; `races.participant_count` garde le nombre de classés. Aucun pseudo d'invité ni saisie brute en base (données minimales, 12 à 17 ans). |
| H-25 | Historique réservé aux membres, 20 courses par page | valable | AUTH-03 : un invité qui ouvre l'historique est redirigé vers l'inscription, un visiteur vers la connexion. Pagination par page fixe de 20 (au plus 10 000 pages) ; le détail d'une course n'est visible que par ses participants enregistrés (HIST-01, HIST-02). |
| H-26 | Statistiques personnelles et records (AUTH-06, RES-04) | valable | Les abandons comptent dans le nombre de courses, mais sont exclus du meilleur MPM, des moyennes MPM/précision et du graphique. Victoire : rang 1, statut finished, au moins deux classés (bots inclus). Record battu : MPM net strictement supérieur au meilleur précédent non abandonné, avec au moins une course précédente admissible ; première course et égalité exclues. Indicateur personal_best persisté dans la transaction ; événement race:records après enregistrement. Profil réservé aux membres : agrégats SQL et courbe SVG des 50 dernières courses non abandonnées, dans l’ordre chronologique, dates localisées. |
| H-27 | Validation des entrées serveur par Zod | valable | Remplace le choix « zéro dépendance ajoutée » : `zod` devient une dépendance directe (TECH-07). Les fonctions `parse*` et `validate*` gardent leurs signatures et enveloppent des schémas exportés ; seule la query du callback OAuth devient plus stricte (2048 caractères au plus par valeur). |
| H-28 | Les bots comptent dans la capacité | valable | SALLE-05 : capacité = coureurs humains + bots (cohérent avec H-3 et la piste de PERF-03) ; spectateurs exclus. Une capacité ou un nombre de bots qui ferait dépasser la limite est refusé (`ROOM_FULL`). |
| H-29 | Visibilité par défaut « sur code » | valable | SALLE-03 : une nouvelle salle n'est pas listée tant que l'hôte ne la rend pas publique (public de 12 à 17 ans). Seule la salle créée depuis « Faire une course » est publique d'emblée (JOIN-03). |
| H-30 | Explorateur et partie rapide | valable | L'explorateur montre aussi les salles publiques pleines, en décompte ou en course, marquées indisponibles (SALLE-09). Un refus `INVITE_REQUIRED` compte comme échec pour la limite de SALLE-10 : il confirme qu'un code existe. |

### Choix encore à trancher

L'énoncé demande de documenter ces choix. Aucun n'est arrêté : l'état actuel est indiqué.

| ID de l'énoncé | Question | Statut | État actuel et proposition |
|---|---|---|---|
| CONF-05 | Critères de complexité | à trancher | Aucun réglage. Proposition : facile = mots courants de 5 lettres ou moins ; moyen = mots courants sans restriction ; difficile = mots longs ou rares, avec ponctuation et chiffres. |
| CONF-07 | Comportement en mode cohérent | à trancher | Le code écarte les phrases qui contiennent un caractère exclu (H-11). À confirmer comme choix final, et à compléter par l'inclusion de caractères. |
| BONUS-01 | Règle exacte des bonus | à trancher | Rien d'écrit. Proposition : à chaque point de contrôle (25, 50, 75 %), tirer un bonus pour chaque joueur en retard (dernier ou 25 % derrière le meneur), au plus 3 par joueur. |
| BOT-01 | Valeurs retenues par niveau | à trancher | Code actuel : 25, 40 et 60 MPM, 3 % de fautes pour tous. Proposition : adopter les cinq plages de l'énoncé (10–20, 20–35, 35–60, 70–100, 140+) avec leurs taux d'erreur. |
| SALLE-08 | Un invité peut-il hériter du rôle d'hôte | à trancher | « Personne humaine connectée » est ambigu. Le projet a choisi oui (voir `docs/ARCHITECTURE.md`) ; à confirmer. |

## Correspondance avec l'ancien cahier des charges

Chaque identifiant de [cahier-des-charges.md](cahier-des-charges.md) figure ici. Rien n'est supprimé : une exigence sans équivalent reste listée, voir la section suivante.

| Ancien ID | Libellé | Nouvel ID ou « hors énoncé » | Remarque |
|---|---|---|---|
| AUTH-1 | Connexion par identifiant et mot de passe | AUTH-01, TEST-03 | Autorisée y compris en production ; sert aux tests de bout en bout. |
| AUTH-2 | Connexion via Discord | AUTH-01 | Obligatoire dans l'énoncé. |
| AUTH-3 | Connexion via GitHub | AUTH-01 | Obligatoire dans l'énoncé. |
| AUTH-4 | Accès en invité avec un pseudo | AUTH-02, AUTH-03 | Pseudonyme de 3 à 20 caractères, pas d'historique. |
| AUTH-5 | Mots de passe hachés | SEC-03 | Argon2, bcrypt ou scrypt. |
| AUTH-6 | Aucune récupération de mot de passe | hors énoncé | Extension conservée : aucun parcours de récupération n'existe. |
| SALLE-1 | Un membre crée une course et devient hôte | SALLE-01 | L'hôte peut être spectateur. |
| SALLE-2 | Visibilité publique, semi-publique ou privée | SALLE-03 | Renommée : publique, sur code, privée. |
| SALLE-3 | Liste des courses publiques | JOIN-02, SALLE-03 | Explorateur avec filtres. |
| SALLE-4 | Accès par code et par code QR | SALLE-02, JOIN-01 | Le code QR est hors énoncé : extension conservée, non prioritaire. |
| SALLE-5 | Course privée par lien à usage unique | SALLE-04 | Un lien par invité, lié à l'IP, 128 bits d'entropie. |
| SALLE-6 | Bouton « Partie rapide » | JOIN-03 | Renommé « Faire une course ». |
| SALLE-7 | Rejoindre comme coureur ou spectateur | SALLE-01, SALLE-05, COURSE-05 | Le vocabulaire (§ 5.1) définit le spectateur ; il ne compte pas dans la capacité. |
| SALLE-8 | Au moins 2 coureurs, bots compris | COURSE-02 | Au moins 2 participants dont 1 humain. |
| SALLE-9 | L'hôte retire un participant | SALLE-07, SEC-01 | Expulsion définitive de cette salle. |
| SALLE-10 | Configuration visible en temps réel | CONF-12 | — |
| SALLE-11 | Courses en équipes | hors énoncé | Extension conservée, non prioritaire. |
| SALLE-12 | Un invité rejoint mais ne crée pas | AUTH-03 | — |
| SALLE-13 | Hôte brièvement déconnecté garde sa place | hors énoncé | Remplacée par SALLE-08 : le rôle passe à la personne connectée la plus ancienne. Le délai de reconnexion vient de COURSE-08. |
| SALLE-14 | L'hôte désigne un nouvel hôte | hors énoncé | Remplacée par le transfert automatique de SALLE-08. Aucune commande de désignation n'existe. |
| SALLE-15 | Le plus ancien devient hôte | SALLE-08 | — |
| CONFIG-1 | Mode phrase ou mots | CONF-03 | Cohérent (corpus) ou aléatoire (dictionnaire). |
| CONFIG-2 | Langue du texte | CONF-02 | — |
| CONFIG-3 | Mots avec accents | CONF-06 | Accents, mais aussi ponctuation, nombres, majuscules. |
| CONFIG-4 | Longueur du texte | CONF-04 | En nombre de mots. |
| CONFIG-5 | Caractères exclus | CONF-07 | Plus l'inclusion de caractères. |
| CONFIG-6 | Limite de temps optionnelle | CONF-01 | De 30 s à 10 min, ou aucune. |
| CONFIG-7 | Mode libre ou bloquant | CONF-08 | Renommé « correction obligatoire » ou « libre ». |
| CONFIG-8 | Bots avec niveau | CONF-10, BOT-01 | Niveau par bot, cinq niveaux. |
| CONFIG-9 | Capacités activées ou non | CONF-09 | Remplacée par l'activation des bonus de remontée. |
| TEXTE-1 | Texte généré par algorithme | CONF-03 | Remplacée : corpus en base (cohérent) ou mots d'un dictionnaire (aléatoire). |
| TEXTE-2 | Texte conforme à la configuration | CONF-02, CONF-04, CONF-06, CONF-07 | — |
| TEXTE-3 | Même texte pour tous | COURSE-03 | Texte commun, révélé au début du décompte. |
| COURSE-1 | Départ commun après compte à rebours | COURSE-03 | Décompte synchronisé. |
| COURSE-2 | Classement en temps réel | COURSE-05 | Piste de progression. |
| COURSE-3 | Fin quand tous ont fini ou limite de temps | COURSE-09 | — |
| COURSE-4 | Reprise après déconnexion | COURSE-08 | 30 secondes. |
| COURSE-5 | Abandon volontaire | COURSE-07 | Avec confirmation. |
| COURSE-6 | Retrait d'un coureur inactif (AFK) | hors énoncé | Extension conservée, non prioritaire : l'énoncé ne prévoit pas d'AFK ; COURSE-08 et COURSE-09 couvrent la déconnexion. |
| COURSE-7 | Copier-coller bloqué | COURSE-04 | — |
| COURSE-8 | Progression validée par le serveur | COURSE-06 | Serveur autoritaire (zone sensible : anti-triche). |
| BOT-1 | Plusieurs niveaux de difficulté | BOT-01 | Cinq niveaux. |
| BOT-2 | Bots au comportement humain | BOT-02, BOT-03 | Plus aucune exception pour le niveau le plus difficile. |
| BOT-3 | Un élève seul joue contre des bots | COURSE-02 | Le minimum est 2 participants dont 1 humain, bots compris. |
| CAPA-1 | Choix d'un personnage | hors énoncé | Remplacée par les bonus de remontée (BONUS-02) ; personnages conservés comme extension, non prioritaire. |
| CAPA-2 | Capacité unique par personnage | BONUS-02 | Remplacée par au moins 3 types de bonus. |
| CAPA-3 | Barre d'énergie | hors énoncé | Extension conservée, non prioritaire. |
| CAPA-4 | Capacité utilisable avec assez d'énergie | hors énoncé | Extension conservée, non prioritaire. |
| CAPA-5 | Mécanique de rattrapage | BONUS-01 | Bonus aux points de contrôle pour les joueurs en retard. |
| CAPA-6 | Personnages débloqués par la progression | hors énoncé | Extension conservée, non prioritaire. |
| RES-1 | Page de résultats avec podium | RES-01 | — |
| RES-2 | MPM, précision, temps et rang | RES-02 | Plus MPM brut, erreurs, statut, bonus. |
| RES-3 | Heatmap des touches ratées | RES-03 | L'un des deux graphiques obligatoires. |
| RES-4 | Relancer ou terminer la session | COURSE-11 | — |
| STATS-1 | Statistiques personnelles | AUTH-06 | Page de profil. |
| STATS-2 | Historique des courses | HIST-01, HIST-02 | — |
| STATS-3 | Graphique de progression | AUTH-06, RES-05 | MPM dans le temps ; la précision n'est plus demandée. |
| STATS-4 | Heatmap cumulative | hors énoncé | Extension conservée, non prioritaire. |
| UI-1 | Nom et logo | DES-01, DES-02 | Faits sans IA. |
| UI-2 | Style professionnel et ludique | DES-04 | Design unique, piste signature. |
| UI-3 | Thème clair et sombre | DES-05, A11Y-01 | — |
| UI-4 | Site responsive | DES-06 | 360 px et plus. |
| UI-5 | Français et anglais | I18N-01, I18N-02, I18N-03 | — |
| TECH-1 | Next.js et TypeScript | TECH-01, TECH-02 | TypeScript à 100 %. |
| TECH-2 | Tailwind CSS | TECH-03 | — |
| TECH-3 | PostgreSQL | TECH-04 | Migrations et seed. |
| TECH-4 | WebSockets | TECH-06 | Technologie libre. |
| TECH-5 | HTTPS obligatoire | TECH-05 | VPS accessible en HTTPS. |
| TECH-6 | Services gratuits | TECH-08 | — |
| QA-1 | Tests unitaires | TEST-01, TECH-09 | Lancés par la CI. |
| QA-2 | Tests de bout en bout | TEST-02, TEST-03 | Playwright. |
| QA-3 | Code source public sur GitHub | hors énoncé | Remplacée par le livrable « dépôt GitHub » de la section 8, avec un historique régulier. |
| QA-4 | Documentation des choix techniques | hors énoncé | Remplacée par les livrables de la section 8 : `ARCHITECTURE.md` (ADR), `DEMARCHE-CREATIVE.md`, `IA.md`, `README.md`. |

### Contradictions et zones floues (C-1 à C-20)

Les C-n ne sont pas des exigences : on garde leur règle quand elle tranche encore quelque chose.

| Ancien ID | Libellé | Nouvel ID ou « hors énoncé » | Remarque |
|---|---|---|---|
| C-1 | Rôle de l'enseignant | SALLE-01 | Résolue : aucun rôle distinct, tout membre peut être hôte. |
| C-2 | Âge et OAuth (13 ans) | H-1 | Toujours valable. |
| C-3 | Invités et statistiques | AUTH-03, H-2 | Un invité n'a pas d'historique persistant. |
| C-4 | Minimum de 2 personnes et élève seul | COURSE-02, H-3 | Les bots comptent. |
| C-5 | « 3 manières de rejoindre » | SALLE-03, JOIN-01, JOIN-03 | Code, lien, explorateur et « Faire une course ». |
| C-6 | Lien qui expire après ouverture | SALLE-04, H-4 | Usage unique lié à l'IP, valable jusqu'à la fermeture de la salle. |
| C-7 | Rattrapage et progression | BONUS-04 | Calcul cohérent quand le texte change. |
| C-8 | Classement avec textes inégaux | COURSE-10, annexe A | Classement et progression en caractères validés. |
| C-9 | Reconnexion et AFK | COURSE-08 | 30 secondes, puis abandon. |
| C-10 | Texte « qui a du sens » gratuit | CONF-03, H-10 | Corpus du domaine public en base. |
| C-11 | Blacklist et mode phrase | CONF-07, H-11 | Choix à confirmer. |
| C-12 | Fin de course sans limite de temps | COURSE-09 | Tous terminés ou abandonnés. |
| C-13 | Équipes | hors énoncé | Extension conservée, non prioritaire (SALLE-11). |
| C-14 | Tablette et clavier virtuel | DES-06, H-12 | Message « clavier physique » sur mobile. |
| C-15 | Heatmap et disposition du clavier | RES-03, H-14 | — |
| C-16 | WebSockets gratuits (Vercel) | TECH-05, TECH-06, H-13 | VPS, ADR-001. |
| C-17 | Brouillage et accessibilité | BONUS-02, A11Y-01 | Le bonus « Brouillard » exige de garder le contraste lisible. |
| C-18 | « Professionnel et funny » | DES-04 | — |
| C-19 | Talent contre rattrapage | BONUS-01, H-17 | Rattrapage par bonus, pas par énergie. |
| C-20 | Durée d'une déconnexion de l'hôte | COURSE-08, SALLE-08 | 30 secondes. |

Les questions Q-1 à Q-9 du client restent consignées dans l'ancien cahier. Leurs réponses sont reprises ci-dessus : Q-1 (SALLE-01), Q-2 (SALLE-04), Q-3 (AUTH-03), Q-4 (SALLE-08), Q-5, Q-7 et Q-8 (« hors énoncé », voir CAPA-1 à CAPA-6), Q-6 (SALLE-03, QR hors énoncé), Q-9 (SALLE-08).

## Exigences hors énoncé conservées

Fonctionnalités de l'ancien cahier sans équivalent dans l'énoncé. Elles ne sont pas prioritaires ; on les traitera après les exigences de l'énoncé.

| Ancien ID | Fonctionnalité | Statut actuel | Remarque |
|---|---|---|---|
| SALLE-4 (QR) | Code QR pour une salle accessible par code | non fait | — |
| SALLE-11, C-13 | Courses en équipes | non fait | Formation des équipes et score à définir. |
| SALLE-13, SALLE-14 | Hôte brièvement déconnecté garde son rôle ; désignation d'un nouvel hôte avant de partir | partiel | Le délai de grâce existe (`graceTimers.ts`) ; aucune commande de désignation. |
| COURSE-6 | Retrait d'un coureur inactif (AFK) | non fait | — |
| CAPA-1 à CAPA-6 | Personnages, capacités, barre d'énergie, déblocage par la progression | non fait | Interrupteur « capacités » présent dans `RaceSettings`, sans effet. |
| STATS-4 | Heatmap cumulative des erreurs | non fait | Dépend de RES-03 et RES-05. |
| H-14 | Disposition du clavier dans le profil (QWERTY, AZERTY, canadien) | complet | Réglage enregistré (`src/profile/profileSettings.ts`, `ProfileForm.tsx`) ; pas encore utilisé par une carte de chaleur. |
| AUTH-6 | Aucune récupération de mot de passe | complet | Aucun parcours de récupération. |
| QA-3 | Dépôt public sur GitHub | complet | Dépôt GitHub ; à garder partagé avec l'enseignant. |
