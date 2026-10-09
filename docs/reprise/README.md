# Reprise du travail Gemini — audit du 8 octobre 2026 et plan d'implémentation

Ce dossier sert à reprendre le travail n'importe où (autre poste, autre session, autre
agent). Lis ce fichier, puis l'étape en cours. Chaque étape a sa fiche avec ses critères
d'acceptation (AC-n) et une case à cocher par tâche.

| Étape | Fiche | Branche | État |
|---|---|---|---|
| 0 | [Remettre `develop` au vert](etape-0-develop-au-vert.md) | `fix/develop-green` | ✅ fusionnée (#38, ménage #41) et en production |
| 1 | [Salle par code en temps réel (checkpoint 1)](etape-1-salle-temps-reel.md) | `feat/realtime-room` | ✅ fusionnée (#40) et en production (`sha-7338783`) |
| 2 | [Course solo propre](etape-2-course-solo.md) | `fix/race-screen` | ⬜ après le checkpoint |

Mets à jour la colonne « État » et les cases des fiches à chaque commit.

## 1. Ce que l'audit a trouvé

Méthode : `qa` a lancé test, lint, build, `build:realtime` et `tsc` sur les deux branches.
Deux `code-reviewer` et deux revues Gemini ont lu les diffs. Ensuite, test réel dans le
navigateur : un membre et un invité dans la même salle.

### `develop` (et `main`, qui a les mêmes fichiers de profil)

**La CI est rouge sur `main` et `develop` depuis la PR #33, et l'image Docker de `main` ne
se construit plus.** La production tourne encore sur l'ancienne image, mais aucun
redéploiement n'est possible tant que ce n'est pas corrigé.

| Gravité | Problème | Où |
|---|---|---|
| Bloquant | `next build` échoue : 10 erreurs de type. La page profil utilise des props qui n'existent pas (`Button size`, `Badge variant`, `className` sur `ButtonLink`, `TextField` sans `label`) | `profile/ProfileForm.tsx`, `profile/page.tsx:51`, `ProfileModal.tsx:119` |
| Bloquant | 19 suites de tests ne démarrent plus (`HTMLDialogElement is not defined`), dont **toute l'auth** et les tests PostgreSQL | `src/test/setup.ts:6` |
| Bloquant | « Se déconnecter » du profil plante : `logout()` est appelé sans `FormData` | `ProfileForm.tsx:91` |
| Bloquant | Choisir « Canadien multilingue » plante : le code envoie `canadian`, la base n'accepte que `cmf` | `profile/actions.ts:13` vs `db/schema.ts:42` |
| Bloquant | Salle inutilisable : le serveur est un bouchon, tout renvoie « Erreur interne » | `realtime/roomHandlers.ts` |
| Majeur | `zod` est importé mais absent de `package.json` (marche par hasard, via une dépendance) | `profile/actions.ts` |
| Majeur | Le pseudo du profil contourne `validatePseudo` (caractères invisibles, espaces seuls) | `profile/actions.ts:12` |
| Majeur | Textes français codés en dur (profil, salle, course, sandbox) : en anglais, l'interface reste en partie en français | voir étape 0 |
| Majeur | Tokens de couleur inexistants (`primary`, `destructive`, `card`, `muted`) : icônes sans couleur, focus invisible | `ProfileModal.tsx`, `sandbox/race` |
| Majeur | Stats factices (« 0 course, 0 MPM ») affichées comme réelles | `ProfileModal.tsx:104` |
| Majeur | Course solo : horloge fausse (+100 ms par tick, faux en onglet de fond), précision faussée après une erreur, pas d'écran de résultats | `components/race/RaceScreen.tsx` |
| Mineur | Fichier parasite `fr_profile.json` (43 Ko, UTF-16) à la racine, `console.log` oublié, page `/sandbox/race` publique et cassée | — |

### `feat/realtime-room-lot-1` (lots 1 à 4 du plan temps réel, non fusionnée)

Test, build et `tsc` passent ; lint échoue (`any`). Le **serveur est bon**. Le **client
est à reprendre**.

Testé en vrai (membre dans le navigateur, invité par script) :

- ✅ Création de salle, code affiché, invité qui rejoint, liste mise à jour sans recharger.
- ✅ L'hôte change la langue et la longueur : l'invité reçoit l'état en direct (SALLE-10).
- ✅ L'invité qui modifie la config reçoit `NOT_HOST`.
- ❌ **« Quitter la salle » remet aussitôt l'hôte dans la salle**, en participant fantôme.
  Ensuite, « Créer une salle » affiche « Vous êtes déjà dans une salle » : l'utilisateur
  est bloqué jusqu'à fermer l'onglet et attendre 60 s. C'est probablement ce que tu as vu.

Autres défauts confirmés en lecture :

- Pas de ré-adhésion après une coupure réseau : l'écran reste figé, puis le joueur est
  expulsé au bout de 60 s.
- Aucune gestion de `connect_error` : avec une session expirée, l'écran reste sur
  « Connexion en cours… ».
- Le délai de 5 s ajouté par Gemini laisse partir l'émission. Une salle peut être créée
  alors que l'interface affiche une erreur.
- Minuteur orphelin quand deux onglets se ferment ensemble.
- La branche **supprime la page profil** (hors périmètre) et duplique l'interface de
  salle qui existe déjà sur `develop`.
- `.dockerignore` : la ligne `.claude` a été ajoutée en UTF-16, donc elle n'exclut rien.
- `docker compose up --build` en local ne peut pas joindre le temps réel : aucun `ARG`
  pour `NEXT_PUBLIC_REALTIME_URL`.
- Textes en dur, tokens inexistants (`text-destructive`), selects sans étiquette.
- Scripts parasites : `scripts/add-dicts.js` et `scripts/Push-PRs.ps1`.

Verdict par lot : lot 1 (`roomStore`) **garder** ; lot 2 (`roomHandlers`) **garder et
corriger** ; lot 3 (interface) **reprendre** ; lot 4 (infra) **garder et corriger**.

### Fausses alertes écartées

Gemini a annoncé un P0 : « le middleware d'authentification n'est pas branché ». C'est
faux, il l'est (`src/realtime/server.ts:45`). Il a aussi vu une suppression du profil
« par accident au merge » : elle est réelle, mais elle vient du commit `dc64318`, pas
d'un merge.

## 2. Ce que j'ai déjà corrigé sur ton poste (hors git)

- **`.env.local` était corrompu.** La ligne `NEXT_PUBLIC_REALTIME_URL=…` avait été
  ajoutée en UTF-16 (redirection PowerShell `>>`). Next ne la lisait pas, donc en
  développement le navigateur cherchait le temps réel sur le port 3000 : aucune salle ne
  pouvait se connecter. Le fichier est réécrit en UTF-8, valeurs inchangées.
- Un compte membre de test local a été créé. Son identifiant et son mot de passe sont
  dans `.env.local` (`TEST_MEMBER_*`).
- `.claude/launch.json` : ajout de la configuration `typio-realtime` (port 3001), à côté
  de `typio-dev`.

> **Piège PowerShell à retenir.** `>>` et `Out-File` sous Windows PowerShell 5.1 écrivent
> en UTF-16. Pour ajouter une ligne à un fichier texte :
> `Add-Content -Encoding utf8 fichier "ligne"`.

## 3. Stratégie retenue

1. **D'abord remettre `develop` au vert** (étape 0). Tant que la CI est rouge, rien ne
   peut partir en production, et les tests d'auth ne protègent plus rien.
2. **Puis intégrer le temps réel dans `develop`** (étape 1). On repart de `develop` à jour,
   on récupère le serveur de `feat/realtime-room-lot-1` (fichiers par fichiers, pas de
   merge, pour ne pas supprimer le profil) et on réécrit le client.
3. **Après le checkpoint**, la course solo, puis la course multijoueur (COURSE-1 à 3).

La branche `feat/realtime-room-lot-1` reste en place comme source. Elle ne sera **pas**
fusionnée telle quelle.

## 4. Reprendre le travail

```bash
docker start typio-dev-db         # base locale (port 5433), Docker Desktop allumé
bun install
bun run dev                       # Next sur http://localhost:3000
bun run dev:realtime              # Socket.IO sur http://localhost:3001
```

- Ouvre `http://localhost:3000`, **pas** `127.0.0.1` : le cookie et l'`Origin` doivent
  correspondre à `APP_ORIGIN`.
- Test à deux clients : un navigateur normal (membre) et une fenêtre privée (invité).
- Validation avant chaque fusion : `bun run test`, `bun run lint`, `bun run build`,
  `bun run build:realtime`. Les tests PostgreSQL demandent
  `DATABASE_URL=postgresql://typio:typio@localhost:5433/typio` dans l'environnement,
  car Vitest ne lit pas `.env.local`.
- Chaîne de validation : implémentation → `qa` → `code-reviewer` (+ `security-reviewer`
  pour l'auth et le temps réel) → commit. Voir `CLAUDE.md`.

## 5. Questions ouvertes pour Patrick

- Qu'est-ce qui « ne marche pas comme tu veux » en dehors des bugs listés ici ? Le
  design, le parcours, le contenu ? Note-le dans cette section pour la prochaine session.
- Statistiques du profil : on masque le bloc jusqu'aux vraies stats (proposé), ou on
  garde « bientôt » ?
- Page `/sandbox/race` : on la supprime (proposé) ou on la réserve au développement ?

## 6. À savoir sur le poste de travail

- Un dossier `scripts/codex/`, non suivi, est apparu pendant la session du 8 octobre. Il
  ne vient pas de Claude, peut-être d'une session Codex. Ses tests cassent `next build` en
  local (`NODE_ENV` manquant dans `ProcessEnv`), parce que `tsconfig.json` inclut
  `**/*.ts`. Il n'est pas commité. Il faut le corriger ou le supprimer avant de faire
  confiance à un `bun run build` local.
- Si deux agents (Claude, Codex, Gemini) travaillent dans le même checkout en même temps,
  leurs fichiers se mélangent. Donne à chacun son worktree.

## 7. Point de reprise (8 octobre, fin de session)

- `fix/develop-green` (étape 0) et `fix/pseudo-homoglyphs` sont fusionnées dans `develop`.
- `feat/realtime-room` (étape 1) : `develop` y est fusionnée, sans conflit. Depuis la
  validation, deux ajouts :
  - revalidation de la session de chaque socket toutes les 90 s (`8550aed`) ;
  - badge « Invité » dans la liste des participants (`085f461`).
  Le tout passe : 1484 tests, lint, build et `build:realtime`.
- La branche `fix/room-guest-badge` (autre session) modifie l'**ancienne** interface de
  salle, que `feat/realtime-room` remplace : elle est obsolète, son intention est reprise
  dans `085f461`. Ne pas la fusionner.
- La PR #36 (`feat/realtime-room-ui-gemini`) est remplacée par `feat/realtime-room` : à
  fermer.
- Codex (`scripts/codex/run.ts`, branche `chore/codex-routing`, non commité) : son canari
  échoue avec « The 'undefined' model is not supported when using Codex with a ChatGPT
  account ». Il faut lui donner un modèle par défaut explicite.
- Reste pour Patrick :
  - autoriser la suppression de `fr_profile.json` et de `src/app/[lang]/sandbox/` ;
  - donner le feu vert mémoire du VPS ;
  - faire la mise en production.
