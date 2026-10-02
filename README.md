# Typio

Plateforme de courses de frappe au clavier pour les élèves du secondaire.

En production : **https://typio.aether-manager.ca**

> État actuel : le squelette. L'application sert la page d'accueil par défaut
> de Next.js — la chaîne de déploiement est en place et vérifiée, le jeu reste
> à écrire.

## La pile

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Vue | React 19 |
| Langage | TypeScript 5 |
| Styles | Tailwind CSS 4 |
| Outils | Bun 1.4 (dépendances, build) |

## En développement

```bash
bun install
bun run dev
```

Puis http://localhost:3000.

```bash
bun run build   # compile comme en production
bun run lint    # ESLint
```

## Comment ça se déploie

Deux moitiés, séparées exprès.

**GitHub Actions compile.** Chaque poussée sur `main` déclenche
`.github/workflows/image.yml`, qui construit l'image Docker et la publie sur
`ghcr.io/patlegrand/typio`.

**Le VPS ne fait que récupérer.** Il n'y a aucune compilation sur le serveur :
il a 1,9 Go de RAM partagés avec les huit conteneurs de `carte` et un swap
déjà entamé. Un `next build` sur place demanderait près d'un gigaoctet, et
l'OOM killer de Linux ne tue pas forcément le build — il pourrait choisir la
base PostgreSQL de la famille.

```bash
ssh root@164.90.160.137 "cd /srv/typio/infra && ./deployer.sh"
```

Le script récupère l'image, redémarre le conteneur et attend que Next réponde
vraiment avant de rendre la main. Pour revenir à une version précise :

```bash
TAG=sha-a1b2c3d ./deployer.sh
```

### Le déploiement n'est pas automatique, et c'est voulu

Actions pourrait se connecter en SSH au VPS après chaque build. Il faudrait
pour cela déposer dans les secrets GitHub une clé privée **root** sur une
machine qui héberge huit services en production. Un dépôt public, un workflow
modifiable par une pull request : le risque n'est pas proportionné au confort
de gagner une commande. Le déploiement reste donc une action délibérée.

## L'infrastructure

| | |
|---|---|
| VPS | `164.90.160.137` — Ubuntu 24.04, 1 vCPU, 1,9 Go |
| Frontal | Caddy (TLS automatique), déjà en place pour d'autres domaines |
| Port interne | `127.0.0.1:8018` |
| Chemin | `/srv/typio/infra` |

Typio partage le Caddy du serveur avec `pilote`, `commandant` et les sept
services de `carte` — il ne lui dispute pas les ports 80 et 443. Son bloc est
greffé **hors** de la zone que gère le `brancher-caddy.sh` de `carte`, et
répète ses propres en-têtes au lieu d'importer le raccourci du voisin : les
deux projets peuvent être redéployés l'un sans l'autre.

```
infra/
├── docker-compose.yml      le conteneur, plafonné à 512 Mo
├── deployer.sh             pull + redémarrage + attente du healthy
├── brancher-caddy.sh       greffe le bloc Caddy (rejouable, avec sauvegarde)
└── caddy/typio.caddyfile   le bloc lui-même
```

Le conteneur n'écoute que sur `127.0.0.1` : depuis internet, il est
injoignable autrement que par Caddy, en TLS.

## Ce qui reste à décider

- **Base de données.** Les comptes élèves, les scores et l'historique des
  courses n'ont pas encore de support. Un PostgreSQL tourne déjà sur le VPS
  (`carte-db-1`) ; le réutiliser ou en monter un à part reste ouvert.
- **Authentification.** Comptes élèves, ou codes de classe sans compte.
- **Content-Security-Policy.** Absente pour l'instant : Next injecte ses
  propres scripts, et une politique stricte demande de leur poser un nonce.

## Tests et validation

Installer avec `bun install --frozen-lockfile`, puis lancer :

- `bun run test` : tests unitaires Vitest, une execution puis sortie.
- `bun run test:watch` : relance des tests pendant le developpement.
- `bun run lint` : verification ESLint.
- `bun run build` : compilation de production.

Les tests sont places dans `src/**/*.test.ts` ou `src/**/*.test.tsx`.
React Testing Library et les assertions jest-dom sont disponibles ; le DOM est nettoye apres chaque test.
Les premiers tests valident le rendu de la page de demarrage, pas encore les fonctionnalites de Typio.
Les composants serveur asynchrones necessiteront des tests d'integration ou de navigateur.

La CI execute tests, lint et build sur les PR vers `develop` et `main`, ainsi que les pushes sur ces branches.
Le controle a rendre obligatoire dans les protections GitHub est `Tests, lint and build`.
Le workflow CI ne deploie rien et ne compile rien sur le VPS.
