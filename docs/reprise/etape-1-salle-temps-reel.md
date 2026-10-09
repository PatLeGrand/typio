# Étape 1 — Salle créée et rejointe par code, en temps réel (checkpoint 1)

- **Branche :** `feat/realtime-room`, partie de `fix/develop-green` une fois l'étape 0 terminée
  (puis rebasée sur `develop` quand l'étape 0 y est fusionnée)
- **Source à réutiliser :** `feat/realtime-room-lot-1`. On prend les fichiers un par un
  (`git checkout feat/realtime-room-lot-1 -- <fichier>`). **Pas de merge** : cette branche
  supprime la page profil et duplique l'interface de salle.
- **Exigences :** SALLE-1, SALLE-4 (code, sans QR), SALLE-7, SALLE-10, SALLE-12, SALLE-13,
  SALLE-15, H-5, H-9, H-16, UI-3, UI-4, UI-5, TECH-4
- **Référence :** [plan-salle-temps-reel.md](../plan-salle-temps-reel.md) (lots et AC
  d'origine), [ADR-001](../architecture/adr-001-temps-reel.md),
  [machine à états](../architecture/machine-a-etats.md) § 1 et § 2.
- **Scénario du checkpoint :** un membre crée une salle, un invité la rejoint par code, la
  liste des participants et la configuration changent chez les deux **sans recharger**.

## Décisions prises (ne pas rediscuter)

Elles corrigent les défauts trouvés à l'audit (voir [README](README.md) § 1).

- **D1 — Une seule vérité côté serveur.** La salle d'un utilisateur, c'est
  `store.roomOf(user.id)`. `socket.data.roomCode` n'est plus qu'un cache. `updateConfig`
  et `leave` fonctionnent donc depuis n'importe quel onglet et après une reconnexion.
- **D2 — Ré-attachement à la connexion.** Quand un socket se connecte et que son
  utilisateur est déjà dans une salle, le serveur fait plusieurs choses : il le met dans
  la room Socket.IO, appelle `store.reconnect`, annule le minuteur de grâce et diffuse
  `room:state`. Rechargement, coupure réseau et nouvel onglet sont ainsi traités au même
  endroit (SALLE-13), sans logique de reconnexion côté client.
- **D3 — Départ.** `room:leave` retire l'utilisateur, diffuse le nouvel état à toute la
  salle (onglets du partant compris), puis sort **tous** ses sockets de la room
  Socket.IO. Un client qui reçoit un état sans lui-même considère qu'il n'est plus dans
  une salle.
- **D4 — Minuteurs.** Le registre des minuteurs de grâce est créé par serveur et passé
  dans `deps` (pas de `Map` globale au module). On fait `clearTimeout` de l'existant avant
  d'en armer un autre. Tout est vidé à la fermeture du serveur.
- **D5 — Client.** Un seul socket par onglet, créé paresseusement dans le navigateur
  (`autoConnect: false`, jamais à l'import ni en SSR). Un **store de module** (lu avec
  `useSyncExternalStore`) garde l'état de connexion et le dernier `RoomState`. Toutes les
  pages lisent le même état.
- **D6 — Rejoindre au chargement de `/room/[code]`.** On émet `room:join` une fois par
  montage (ref), seulement si l'état connu n'est pas déjà cette salle. Pas de nouveau
  `join` quand l'état devient `null` : c'est le bug du participant fantôme.
- **D7 — Quitter.** Le bouton appelle `leave()`, puis `router.replace("/[lang]/play")`.
  Quitter la page sans le bouton (retour arrière, lien) **ne quitte pas** la salle.
  `/play` affiche alors « Tu es dans la salle ABC123 » avec « Y retourner » et
  « Quitter », et désactive créer et rejoindre tant que c'est le cas.
- **D8 — Accusés.** `socket.timeout(5000).emit(...)`. Pas d'émission si le socket n'est
  pas connecté. Le client a ses propres codes, `OFFLINE` et `TIMEOUT`, traduits comme les
  autres. Aucune `string` libre dans les erreurs.
- **D9 — `connect_error`.** `UNAUTHENTICATED` mène à la page de connexion. Les autres
  erreurs affichent un bandeau « Connexion perdue, nouvelle tentative… », et on relance
  la connexion si Socket.IO ne le fait pas seul.
- **D10 — Emplacement de l'interface.** On garde la structure de `develop` :
  `src/app/[lang]/(site)/play/PlayClient.tsx` et `room/[code]/RoomClient.tsx`. On
  n'importe **pas** `src/components/room/*` de la branche lot-1. Les dictionnaires ont une
  seule section `room`, avec une clé par valeur du protocole (`sentences`, `words`,
  `short`, `medium`, `long`, chaque durée, « aucune ») et `room.errors.<CODE>` pour chaque
  code de `ROOM_ERROR_CODES`, plus `OFFLINE` et `TIMEOUT`.
- **D11 — Contrat.** `src/realtime/protocol.ts` ne change pas. D2 et D3 n'utilisent que
  l'événement `room:state` existant.
- **D12 — Infra.** On reprend le lot 4 avec trois corrections : `.dockerignore` réécrit en
  UTF-8 ; `ARG NEXT_PUBLIC_REALTIME_URL` dans le `Dockerfile` et `build.args` dans le
  `docker-compose.yml` local ; aucun des deux scripts parasites (`add-dicts.js`,
  `Push-PRs.ps1`).

## Lots

### 1A — Serveur (`implementer`)

Fichiers : `src/realtime/roomStore.ts` et son test (repris du lot-1),
`src/realtime/roomHandlers.ts` et son test (repris, puis corrigés selon D1 à D4),
`src/realtime/server.ts`.

- [x] Reprendre `roomStore` et ses tests ; ajouter le test AC-10 du plan (code jamais
  celui d'une salle ouverte). Remplacer `this.roomOf` par une fonction locale.
- [x] `roomHandlers` selon D1 à D4.
- [x] Tests d'intégration (`startTestServer`) : les AC-1 à AC-8 du lot 2 du plan, plus :
  - **S-1** Rechargement : B ferme son socket et en ouvre un nouveau sans `join`. Il reçoit
    l'état, `connected: true`, même `joinedAt` (D2).
  - **S-2** Expiration : avec `vi.useFakeTimers()`, B déconnecté depuis plus de
    `RECONNECT_GRACE_MS` est retiré, et A le voit.
  - **S-3** Multi-onglet : A a deux sockets. En fermer un ne le marque pas déconnecté ; fermer
    les deux en même temps n'arme qu'un minuteur, et revenir l'annule.
  - **S-4** `leave` depuis un onglet : l'autre onglet reçoit un état sans A et ne reçoit
    plus les diffusions suivantes (D3).
  - **S-5** `updateConfig` après reconnexion fonctionne (D1).

### 1B — Infra (`implementer-light`, en parallèle de 1A)

- [x] Reprendre du lot-1 : `Dockerfile`, `docker-compose.yml`, `infra/docker-compose.yml`,
  `infra/caddy/typio.caddyfile`, `infra/deployer.sh`, `.github/workflows/ci.yml`,
  `.env.example`.
- [x] Corrections D12. Remettre les commentaires de `deployer.sh` supprimés par Gemini.
- [x] `docker compose config --quiet` et
  `MDP_TYPIO=x docker compose -f infra/docker-compose.yml config --quiet` passent.

> ⚠️ **Mémoire du VPS.** Le service `realtime` ajoute environ 50 à 60 Mo (limite 128 Mo),
> sur un VPS qui n'a que 346 Mo libres, partagés avec `carte`. **Patrick valide avant le
> déploiement.**

### 1C — Client et pages (`implementer`, après 1A)

Fichiers : `src/realtime/client.ts`, `src/realtime/useRoom.ts` (ou `roomStore.client.ts`
et le hook), `play/page.tsx`, `play/PlayClient.tsx`, `room/[code]/page.tsx`,
`room/[code]/RoomClient.tsx`, les dictionnaires FR et EN, `HomeHero.tsx`,
`HomeCallToAction.tsx`.

- [x] D5 à D10.
- [x] Page `/play` : « Créer une salle » pour les membres. Pour un invité, le bouton est
  désactivé avec la raison (SALLE-12). « Rejoindre avec un code » : champ de 6 caractères,
  normalisé en majuscules, avec un groupe radio coureur/spectateur dans un
  `fieldset`/`legend`. Sans session, redirection vers la connexion. `generateMetadata`
  conservé.
- [x] Page `/room/[code]` : le code en grand, copiable, avec un retour « Copié » ; une
  repli si `navigator.clipboard` est absent. Participants : nom, rôle, badge hôte, « toi »,
  déconnecté, dans une liste `aria-live="polite"`. Config éditable par l'hôte (selects
  **étiquetés**), en lecture seule pour les autres. Bouton « Quitter ». Chaque refus
  affiche un message traduit, jamais un code brut. Pas de bouton « Lancer la course » ni
  d'« Ajouter un joueur » : hors périmètre, ils ne feraient rien.
- [x] Tests Vitest avec un faux store : formulaire de code (normalisation, validation), vue
  hôte et vue participant, bandeau « déjà dans une salle », pas de nouveau `join` après
  `leave`.

### 1D — Validation

- [x] `qa` : les quatre commandes, puis le scénario à deux navigateurs (membre en fenêtre
  normale, invité en fenêtre privée), en FR et en EN, en clair et en sombre, mobile et
  ordinateur.
- [x] `code-reviewer` sur tout le diff.
- [x] `security-reviewer` (deux passes) : confiance des messages WebSocket, `Origin`, cookies, codes de
  salle, D2 (le ré-attachement ne doit dépendre que de la session).
- [x] Gemini `review`, `ui`, `visual` en parallèle (second avis seulement).

## Critères d'acceptation

- **AC-1** Scénario du checkpoint : la liste passe à 2 chez les deux, sans recharger.
- **AC-2 (SALLE-10)** Langue, mode, longueur ou limite changés par l'hôte : l'autre écran se
  met à jour en moins d'une seconde.
- **AC-3** « Quitter » ramène à `/play`. On peut ensuite créer ou rejoindre une autre salle
  sans erreur, et les autres voient le départ et le nouvel hôte (SALLE-15).
- **AC-4 (SALLE-13)** Recharger la page de salle garde la place, le rôle d'hôte et
  `joinedAt`. Couper le réseau 10 s : l'écran se remet à jour au retour.
- **AC-5** Un invité ne peut pas créer, et la raison est affichée (SALLE-12). Un code inconnu
  et une salle pleine affichent un message traduit.
- **AC-6 (UI-3, UI-4, UI-5)** Aucun texte en dur, tokens existants seulement, clair et
  sombre, mobile et ordinateur.
- **AC-7** test, lint (0 erreur, 0 avertissement dans les fichiers touchés), build et
  `build:realtime` passent.

## Journal

- 2026-10-08 : fiche écrite. Attend la fin de l'étape 0.
- 2026-10-08 : 1A, 1B et 1C livrés et commités (`e6edb99` import, `03d2780` infra, `57453fb`
  serveur, `10c0b64` client).
  - Testé en vrai : un membre dans le navigateur, un invité par script. Création, jonction,
    config en direct, rechargement (l'hôte garde son rôle), « Quitter » (l'invité
    devient hôte, plus de fantôme), recréation immédiate, bandeau « tu es dans la
    salle » en EN et sur mobile.
  - `qa` : PASS (1432 tests, lint, build, `build:realtime`, `/healthz`, `protocol.ts`
    inchangé).
  - `code-reviewer` : 3 P2 (dernier partant pas notifié dans ses autres onglets ; socket
    jamais reconnecté après une session expirée ; `join` en TIMEOUT qui bloque la vue).
  - `security-reviewer` : rien de critique. M1 (énumération des codes), M2 (socket qui
    survit à la déconnexion), M3 (mémoire) et F5 (ports du compose local) **corrigés
    avant le checkpoint**.

- 2026-10-08 : correctifs de revue commités.
  - `1cf98f7` serveur : dernier partant ; limite de 10 échecs de `join` par minute ;
    20 spectateurs au plus ; coupure à l'expiration de la session ; messages de 8 Kio
    au plus ; 5 sockets par utilisateur ; index.
  - `8c9f47a` client : reconnexion après expiration ; nouvel essai de `join` ;
    `RoomSessionGuard` (coupe le socket au logout) ; bandeau « trop d'onglets ».
  - `7e6ce83` : test de la course du plafond de sockets et derniers détails.
- Revérifié dans le navigateur : deux onglets du même membre, « Quitter » dans l'un,
  l'autre affiche « Tu n'es plus dans cette salle ». Un invité rejoint toujours
  normalement.
- Résultats : 1481 tests, lint (1 avertissement, dans `sandbox`, en attente de
  suppression), build, `build:realtime` et `protocol.ts` inchangé.

**Reste avant de fusionner :**

1. Fusionner `fix/develop-green` dans `develop` (PR).
2. Rebaser `feat/realtime-room` sur `develop`, puis ouvrir sa PR.
3. Patrick valide la mémoire du VPS (service `realtime`, environ 60 Mo, limite 128 Mo)
   avant le déploiement.

### Choix assumés

- Au-delà de 10 échecs de `join` en une minute, la réponse est `INVALID_CODE` sans
  consulter le registre, parce que le protocole n'a pas de code « trop de tentatives ».
- Si la base tombe en panne, l'en-tête voit « pas d'utilisateur ». Le garde coupe alors
  le socket, et `useRoom` le relance. Résultat : un bref flash, pas un blocage.

### Reporté après le checkpoint (sécurité)

- Revalider la session sur chaque commande et couper les sockets à la déconnexion depuis
  un autre appareil (`LISTEN/NOTIFY` PostgreSQL).
- **Plafond par IP et plafond global** (constats de la seconde passe
  `security-reviewer`, à traiter avant une ouverture large, pas pour un pilote encadré).
  Un attaquant peut créer des invités (120 par heure et par IP) avec chacun 5 sockets
  et 10 échecs de `join` par minute. Il épuise ainsi la mémoire, environ 14 000 sockets
  en 24 h, et énumère les codes de façon répartie. Il faut un compteur par IP, à partir
  de `X-Forwarded-For` lu seulement depuis Caddy, pour les poignées de main, les sockets
  et les échecs de `join`, et un plafond global (`io.engine.clientsCount`).
- F4 : `room:state` diffuse le `userId` stable de chaque participant, ce qui permet de
  suivre un mineur d'une salle à l'autre. Remplacer par un identifiant opaque par salle.
  Cela change `protocol.ts`.
- F6 : donner au conteneur `realtime` un rôle SQL limité (`SELECT` sur `sessions` et
  `users`, `DELETE` sur `sessions`).
- SALLE-9 (retirer un participant) devient important dès qu'un inconnu peut entrer.
