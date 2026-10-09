# Étape 3 — Une seule entrée « Créer une course », puis la course multijoueur

- **Branche :** `feat/race-entry` (tranche A), partie de `develop` (`3e133cc`)
- **Remplace :** [étape 2](etape-2-course-solo.md), absorbée par la tranche A.
- **Exigences :** CONFIG-1 à 7, TEXTE-1 à 3, COURSE-1 à 3, COURSE-5, COURSE-7, RES-1,
  RES-2, BOT-2, BOT-3, SALLE-8, SALLE-12, UI-3 à 5, H-9, H-10, H-11
- **Besoin (Patrick, 9 octobre) :** « Créer une course » doit ouvrir la page de
  paramètres de Gemini (`/race/settings`), qui plaît. De là, on lance une course seul
  contre des bots, ou on invite des amis dans une salle, puis l'hôte lance la course
  pour tous.

## Ce qui existe

- `/[lang]/race/settings` (`SettingsForm.tsx`) : beau, en ligne, mais **aucun lien n'y
  mène**. Il est hors du layout `(site)`, donc sans en-tête du site.
- `/[lang]/race` (`RaceScreen.tsx`, `RaceVisualizer.tsx`) : course solo jouable contre
  des bots simulés, avec les défauts de l'audit : horloge à +100 ms par tick, précision
  faussée après une erreur, pas d'écran de fin ni d'abandon, phrases fixes dans le même
  ordre, mode « Mots » qui coupe une phrase, bots sans erreurs, textes en dur, scène
  claire en mode sombre.
- Salle par code en temps réel (étape 1). Sa config ne porte que `textMode`, `language`,
  `length` et `timeLimitSeconds`.

## Découpage

| Tranche | Contenu | Protocole |
|---|---|---|
| **A** | Entrée unique, page de paramètres dans le site, course solo juste avec écran de résultats | inchangé |
| **B** | « Inviter des amis » depuis les paramètres : la salle porte tous les réglages de texte et de saisie ; la salle d'attente reprend les composants de la page | étendu (orchestrateur) |
| **C** | Course multijoueur : « Lancer » par l'hôte, compte à rebours, même texte pour tous, progression validée par le serveur, classement en direct, résultats | étendu (orchestrateur) |

B et C seront détaillées quand A sera fusionnée.

## Tranche A — décisions prises

- **A-D1 — Entrées.** Sur l'accueil :
  - « Créer une course » ouvre `/[lang]/race/settings` ;
  - « Rejoindre avec un code » ouvre `/[lang]/play`.

  Sur `/play`, le bloc « Créer une salle » reste, en attendant la tranche B.
- **A-D2 — La page de paramètres entre dans le site.** On la déplace dans le groupe
  `(site)`, sous `src/app/[lang]/(site)/race/settings/`, pour qu'elle ait l'en-tête, la
  langue, le thème et le profil. Le groupe de route ne change pas l'URL. L'écran de
  course `/[lang]/race` reste plein écran, sans en-tête.
- **A-D3 — Ouverte aux invités.** Un invité peut s'entraîner seul contre des bots (BOT-3).
  Pas de connexion exigée pour la course solo, comme aujourd'hui.
- **A-D4 — Limite de temps alignée sur le protocole.** Le choix devient la liste
  `TIME_LIMITS_SECONDS` de `protocol.ts` : aucune (5 min par défaut, H-9), 1, 2, 3, 5 ou
  10 min. La saisie libre de 1 à 600 s disparaît.
  - `RaceSettings` reprend les types de `RoomConfig` pour les quatre champs communs, ce
    qui prépare la tranche B.
  - Une ancienne URL `?config=` avec une durée hors liste est refusée par
    `parseRaceSettings`, et la page de course renvoie alors aux paramètres, comme
    aujourd'hui pour une config invalide.
- **A-D5 — Textes (TEXTE-1, TEXTE-2, H-10, H-11).** Un module pur
  `src/race/textGenerator.ts` remplace les phrases fixes : il **tire au hasard**
  (`random` injecté) dans une banque de phrases du domaine public par langue (au moins 30
  phrases par langue), et dans une liste de mots fréquents par langue (au moins 200 mots)
  pour le mode « Mots ». Il respecte :
  - la longueur : court environ 100 caractères, moyen environ 200, long environ 350 ;
  - les accents : sans accents, une phrase qui en contient est **exclue** en mode
    phrases, et le mot est remplacé par sa forme sans accent en mode mots ;
  - la liste noire : une phrase contenant un caractère exclu est **exclue** (H-11), un
    mot contenant un caractère exclu est écarté.

  Si les filtres ne laissent rien, le module rend un code d'erreur, et l'interface
  l'explique au lieu de lancer une course vide. Ce module sera réutilisé par le serveur à
  la tranche C : il ne dépend ni de React ni du navigateur.
- **A-D6 — Mesures (formules des courses de frappe courantes).**
  - **MPM** = (caractères corrects tapés ÷ 5) ÷ minutes écoulées, arrondi à l'entier.
  - **Précision** = frappes correctes ÷ frappes totales, en pourcentage arrondi à
    l'entier. Une frappe fausse corrigée ensuite reste comptée comme fausse. Effacer
    n'est pas une frappe.
  - **Temps** : du départ (fin du compte à rebours) à la dernière frappe juste, ou à la
    limite de temps.
  - L'horloge vient d'un horodatage de départ (`performance.now()`), jamais d'un cumul de
    ticks.
- **A-D7 — Fin de course et résultats (COURSE-3, COURSE-5, RES-1, RES-2).**
  - La course se termine quand le texte est fini, quand la limite est atteinte, ou sur
    « Abandonner ».
  - L'écran de résultats montre le podium (toi et les bots), puis MPM, précision, temps et
    rang pour chacun ; un abandon est classé en dernier, marqué « Abandon ».
  - Actions : « Rejouer », qui relance avec les mêmes réglages et un nouveau texte, et
    « Modifier les réglages », qui ramène à la page de paramètres.
- **A-D8 — Bots (BOT-2).** Vitesse cible par difficulté : facile 25 MPM, normale 40 MPM,
  difficile 60 MPM. Variation de ±20 % par mot, pauses courtes au hasard et erreurs
  corrigées (le bot recule). Noms tirés d'une liste du dictionnaire FR/EN. Logique pure
  et testable dans `src/race/bots.ts`, avec horloge et hasard injectés.
- **A-D9 — Interface (UI-3, UI-5).**
  - Aucun texte en dur, notamment les ordinaux et « Arrivée : … px ».
  - Le temps restant est visible, et pas seulement en `sr-only`.
  - La scène Pixi a des couleurs pour le thème sombre.
  - Le copier-coller reste bloqué (COURSE-7).

## Tranche A — lots

| Lot | Contenu | Qui | Fichiers |
|---|---|---|---|
| A1 | `textGenerator.ts` (A-D5) et `bots.ts` (A-D8), purs, avec tests | Codex niveau 2 | `src/race/textGenerator.ts`, `src/race/bots.ts`, leurs tests, données de phrases et de mots sous `src/race/data/` |
| A2 | Entrées et page de paramètres (A-D1 à A-D4) | Codex niveau 2 | `src/app/[lang]/(site)/race/settings/*` (déplacé), `src/race/config.ts` (+ test), `HomeHero.tsx`, `HomeCallToAction.tsx`, dictionnaires (section `raceSettings` et accueil) |
| A3 | Écran de course (A-D6, A-D7, A-D9) branché sur A1, après A1 | `implementer` (niveau 3 : état temps réel délicat) | `src/components/race/*`, `src/race/metrics.ts` (+ test), `src/app/[lang]/race/page.tsx`, dictionnaires (section course), suppression de `src/race/sentences.ts` |

A1 et A2 partent en parallèle. A3 attend A1.

## Critères d'acceptation (tranche A)

- **AC-1** Sur l'accueil, « Créer une course » ouvre la page de paramètres, avec l'en-tête
  du site. « Rejoindre avec un code » ouvre `/play`.
- **AC-2** La limite de temps propose aucune, 1, 2, 3, 5 et 10 min. Une config
  d'URL invalide ramène aux paramètres.
- **AC-3** Deux courses de suite avec les mêmes réglages n'ont pas le même texte. Le texte
  respecte la langue, la longueur (±25 %), les accents et les caractères exclus. Si les
  filtres ne laissent rien, un message traduit s'affiche.
- **AC-4** Une course d'une minute dure une minute, onglet visible ou non. Le temps
  restant est affiché.
- **AC-5** Taper 10 caractères avec 1 erreur corrigée donne 91 % de précision
  (10 ÷ 11).
- **AC-6** Fin de texte, fin du temps ou abandon mènent à l'écran de résultats (podium,
  MPM, précision, temps, rang). « Rejouer » change le texte.
- **AC-7** Les bots ne finissent pas tous au même moment. Un bot difficile bat un bot
  facile dans plus de 90 % des courses simulées (test avec graines).
- **AC-8** FR/EN, clair/sombre, mobile et ordinateur, aucun texte en dur. Le coller est
  bloqué.
- **AC-9** test, lint (0 erreur, 0 avertissement), build et `build:realtime` passent.

## Tranche B — la salle porte tous les réglages (CONFIG-1 à 8)

- **Branche :** `feat/room-settings`, partie de `develop` une fois la tranche A fusionnée.
- **Exigences :** CONFIG-1 à 8, SALLE-1, SALLE-10, SALLE-12, H-3, H-16, UI-3 à 5.
- **Hors périmètre :** lancement de la course multijoueur (tranche C), capacités (CONFIG-9).

### Décisions prises

- **B-D1 — Protocole étendu (orchestrateur).** `RoomConfig` gagne `accents: boolean`,
  `excludedCharacters: string`, `inputMode: "free" | "blocking"`, `botCount: number`
  (entier de 0 à 7) et `botDifficulty: "easy" | "normal" | "hard"`. `abilities` n'entre
  pas dans le protocole tant que CONFIG-9 n'existe pas.
  - `DEFAULT_ROOM_CONFIG` : comme la course solo, sauf `botCount: 0` (on invite des amis).
  - `parseRoomConfigPatch` valide chaque nouvelle clé et refuse toute valeur hors liste.
  - `excludedCharacters` est **normalisé par le serveur** : caractères uniques, pris dans
    une liste blanche (lettres latines avec les accents du français, chiffres, ponctuation
    ASCII et française), 30 au plus, puis **triés** ; une chaîne brute de plus de 100
    caractères est refusée. L'hôte ne choisit ni les glyphes ni l'ordre : la salle affiche
    un jeu de caractères, jamais un mot lisible (revue `security-reviewer` du 9 octobre).
- **B-D2 — Les bots comptent comme coureurs (H-3, H-16).** Coureurs humains + `botCount`
  ≤ `MAX_RUNNERS` (20). Un `room:join` en coureur ou un `room:updateConfig` qui
  dépasserait ce plafond reçoit `ROOM_FULL`.
- **B-D3 — Un seul type de réglages.** `RaceSettings` devient `RoomConfig` plus
  `abilities` ; `parseRaceSettings` réutilise la validation du protocole. La page solo et
  la salle ne peuvent plus diverger.
- **B-D4 — « Inviter des amis » depuis les paramètres.** La page `/race/settings` gagne
  un bouton secondaire « Inviter des amis » à côté de « Lancer la course ». Pour un membre,
  il crée la salle avec les réglages choisis (`room:create`), puis ouvre `/room/[code]`.
  Pour un invité, il est désactivé et la raison est affichée (SALLE-12). Sur `/play`, le
  bloc « Créer une salle » devient un lien vers `/race/settings` ; « Rejoindre avec un
  code » ne change pas.
- **B-D5 — La salle d'attente reprend les composants de la page.** Les sections de
  `SettingsForm` sont extraites dans un composant contrôlé `RaceSettingsFields`
  (`value`, `onChange(patch)`, `readOnly`). La page solo l'utilise avec un état local ; la
  salle l'utilise avec `room:updateConfig` pour l'hôte et en lecture seule pour les
  autres. Le champ des caractères exclus envoie son patch à la sortie du champ ou après
  500 ms sans frappe, pas à chaque touche.

### Lots

| Lot | Contenu | Qui | Fichiers |
|---|---|---|---|
| B1 | B-D1 à B-D3 : protocole, magasin des salles, `race/config.ts`, tests | Codex niveau 2, sur spécification exacte de l'orchestrateur | `src/realtime/protocol.ts`, `src/realtime/roomStore.ts`, `src/race/config.ts`, leurs tests |
| B2 | B-D4, B-D5 : composant partagé, salle d'attente, bouton « Inviter des amis », `/play`, dictionnaires | `implementer` (niveau 3), après B1 | `src/components/race/RaceSettingsFields.tsx`, `SettingsForm.tsx`, `room/_components/*`, `play/*`, dictionnaires |

Validation : `qa`, `code-reviewer`, `security-reviewer` (confiance dans les messages
WebSocket), Gemini `review`, `ui` et `visual`.

### Critères d'acceptation (tranche B)

- **AC-B1** Un membre règle la course, clique « Inviter des amis » et arrive dans une salle
  qui porte exactement ces réglages.
- **AC-B2** Quand l'hôte change un réglage, un autre participant le voit sans recharger,
  pour chacun des huit réglages CONFIG-1 à 8.
- **AC-B3** Un client modifié qui envoie une valeur hors liste, une clé inconnue,
  `botCount: 8` ou 101 caractères exclus reçoit `INVALID_PAYLOAD`, et l'état ne change pas.
- **AC-B4** Avec 18 coureurs humains, passer à 3 bots est refusé (`ROOM_FULL`) ; avec
  5 bots, le 16e coureur humain est refusé.
- **AC-B5** Un invité voit « Inviter des amis » désactivé, avec la raison.
- **AC-B6** Les non-hôtes voient les réglages en lecture seule. FR/EN, clair/sombre,
  mobile et ordinateur, aucun texte en dur.
- **AC-B7** test, lint (0 erreur, 0 avertissement), build et `build:realtime` passent.

## Journal

- 2026-10-09 : plan écrit, tranche A lancée.
- 2026-10-09 : corrections de relecture de la tranche A ; plan de la tranche B écrit.
- 2026-10-09 : tranche A fusionnée (PR #51). Tranche B : B1 par Codex niveau 2, B2 par
  `implementer`. `security-reviewer` a fait durcir les caractères exclus (liste blanche,
  minuscules, tri) ; `code-reviewer` et Gemini : constats mineurs corrigés.
