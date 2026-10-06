# Typio + PostgreSQL — spécification devops

> Mesures prises sur le VPS le 2 octobre 2026. Version vivante et commentable :
> https://claude.ai/code/artifact/26c036cd-2027-43b8-87b1-ff9d1ee3da79

## Le besoin, et la contrainte qui le complique

Typio doit gagner une base de données, et tenir deux exigences qui s'excluent
dans un seul fichier compose :

1. **Démarrer d'une seule commande sur la machine d'un correcteur**, qui ne
   connaît rien de l'infrastructure existante et n'a pas à la connaître.
2. **Partager le PostgreSQL déjà en place sur le VPS** (`carte-db-1`), parce que
   le droplet n'a pas la mémoire pour une seconde instance.

À quoi s'ajoute une contrainte propre à Typio, déjà inscrite dans le `Dockerfile`
et dans `infra/deployer.sh` : **le VPS ne construit jamais l'image**. Un
`next build` y réclamerait près d'un gigaoctet, et l'OOM killer ne choisit pas sa
victime parmi les seuls processus fautifs. Le serveur fait un `docker pull` de
l'image publiée par GitHub Actions, rien d'autre.

Le correcteur, lui, **doit** construire : il n'a pas accès à GHCR, et on ne va
pas lui demander de s'authentifier sur un registre privé.

**Construire d'un côté, tirer de l'autre : c'est la différence structurante**, et
elle interdit la solution habituelle d'un fichier de base avec une surcharge.

## La forme retenue : deux fichiers autonomes, pas une surcharge

| Fichier | Pour qui | Image | Base |
| --- | --- | --- | --- |
| `docker-compose.yml` (racine, **à créer**) | le correcteur, en local | `build: .` | la sienne, service `db` |
| `infra/docker-compose.yml` (**existe**, à compléter) | le VPS | `image: ghcr.io/patlegrand/typio` | `carte-db-1`, partagée |

J'ai écarté le montage `-f base.yml -f override.yml` pour trois raisons :

- Les deux fichiers ne partagent presque rien : build contre pull, avec ou sans
  service `db`, avec ou sans `mem_limit`, avec ou sans `logging`, port
  `3000:3000` contre `127.0.0.1:8018:3000`. Ce qui se répète se réduit au nom du
  service et au healthcheck.
- `infra/deployer.sh` appelle `docker compose pull web` puis `up -d web` depuis
  `infra/`. Une surcharge obligerait à changer le déployeur et à éclater la
  configuration du VPS sur deux répertoires.
- Le fichier du VPS existe déjà, commenté, et fonctionne. Le casser pour gagner
  une factorisation de deux lignes serait un mauvais échange.

```
  En local — le correcteur             Sur le VPS
  ┌─────────────────────────┐          ┌──────────────────────────────┐
  │ réseau typio_default    │          │ typio_default +              │
  │                         │          │ carte_default (externe)      │
  │   ┌─────────────────┐   │          │   ┌──────────────────────┐   │
  │   │ web  (build: .) │   │          │   │ web  (image GHCR)    │   │
  │   │ localhost:3000  │   │          │   │ 127.0.0.1:8018       │   │
  │   └────────┬────────┘   │          │   └──────────┬───────────┘   │
  │            ▼            │          │              ▼               │
  │   ┌─────────────────┐   │          │   ┌══════════════════════┐   │
  │   │ db              │   │          │   ║ carte-db-1 · partagé ║   │
  │   │ postgres:17     │   │          │   ║ + les 7 API famille  ║   │
  │   │ volume db-data  │   │          │   ╚══════════════════════╝   │
  │   └─────────────────┘   │          │                              │
  └─────────────────────────┘          └──────────────────────────────┘
```

## L'état mesuré du VPS

**Le VPS est à l'étroit en CPU, pas en RAM.** C'est l'inverse de l'impression que
donne `free -m`, et ça change ce qu'on a le droit d'y ajouter.

Droplet DigitalOcean `ubuntu-s-1vcpu-1gb-fra1`, **1 vCPU**, 1 967 Mo de RAM,
2 047 Mo de swap, 48 Go de disque. 45 jours d'uptime.

| Indicateur | Valeur | Lecture |
| --- | --- | --- |
| RAM utilisée | 1 604 / 1 967 Mo | 90 Mo libres, 363 disponibles |
| Swap utilisé | 888 / 2 047 Mo | ~1,7 Go écrit par jour |
| PSI mémoire `full` avg300 | 0,51 % | pas de thrashing |
| OOM kills en 45 jours | 0 | aucun conteneur tué |
| PSI CPU `some` avg300 | **46,6 %** | le vrai goulot |
| Load average | 1,64 / 3,37 / 3,95 | sur **1** cœur |
| Disque | 16 / 48 Go (33 %) | large |

Le swap n'est pas un symptôme de détresse : le noyau range au frais des pages
froides, et la pression mémoire réelle reste basse. La charge CPU, elle, arrive
par à-coups — `avg10` était redescendu à 7,5 % au moment de la mesure.

### Le PostgreSQL déjà en place

`carte-db-1`, image `postgres:17-alpine`, up depuis 4 semaines, `healthy`.

| | Valeur |
| --- | --- |
| RAM du conteneur | **20,3 Mo** |
| CPU | 0,00 % |
| Données sur disque | 109,6 Mo |
| Bases hébergées | 7 (`ancien`, `budget`, `calendrier`, `cuisine`, `projets`, `socle`, `taches`), ~8 Mo chacune |
| `max_connections` | 100, dont **23 ouvertes** |
| `shared_buffers` | 128 Mo (défaut) |
| Exposition | `5432/tcp`, aucun mapping vers l'hôte |

Ajouter une 8ᵉ base coûte ~8 Mo de disque et ~0 Mo de RAM. Une seconde instance
PostgreSQL coûterait 128 Mo de `shared_buffers` réservés d'office plus
l'overhead, soit **150 à 250 Mo** — avec 90 Mo libres, c'est exclu, et pour rien.

## À créer : `docker-compose.yml` à la racine

**Règle directrice : `docker compose up --build` doit marcher sur un clone frais,
sans aucun fichier à créer.** Un correcteur qui doit d'abord copier un `.env` est
un correcteur qui peut se tromper.

### Service `db`

| Point | Valeur | Pourquoi |
| --- | --- | --- |
| `image` | `postgres:17-alpine` | même version que le VPS, multi-arch (Intel et Apple Silicon) |
| `environment` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` avec des défauts `${VAR:-valeur}` | le `up` marche sans `.env` |
| `volumes` | `db-data:/var/lib/postgresql/data` | volume nommé, déclaré en bas du fichier |
| `healthcheck` | `pg_isready -U $USER`, `interval 5s`, `retries 10` | **indispensable**, voir plus bas |
| `ports` | **aucun**, en commentaire | 5432 est souvent occupé par un PostgreSQL local ; proposer 5433 en commentaire |

Les identifiants de développement sont en clair et assumés : la base ne contient
que des données de démonstration et n'est joignable que depuis le réseau Docker
du projet.

### Service `web`

| Point | Valeur | Pourquoi |
| --- | --- | --- |
| `build` | `context: .` | le `Dockerfile` de la racine, tel quel — il construit déjà très bien en local |
| `depends_on` | `db:` avec `condition: service_healthy` | **indispensable**, voir plus bas |
| `DATABASE_URL` | `postgresql://typio:...@db:5432/typio` | `db` est résolu par Docker |
| `ports` | `"3000:3000"` | Next écoute sur 3000 ; **pas** de préfixe `127.0.0.1:`, il n'y a pas de Caddy sur un poste de bureau |
| `healthcheck` | le même que sur le VPS | cohérence, et `docker compose ps` dit la vérité |
| `mem_limit` | **aucun** | contrainte du VPS, elle n'a rien à faire ici |

### Le piège à ne pas rater

**Le healthcheck n'est pas décoratif.** Sans lui, `web` démarre avant que
PostgreSQL accepte les connexions, plante, et le correcteur voit une erreur qui
n'est pas la sienne. `depends_on` seul ne suffit pas : il attend que le conteneur
*existe*, pas qu'il *réponde*. Il faut la paire `healthcheck` sur `db` +
`condition: service_healthy` sur `web`.

## À compléter : `infra/docker-compose.yml`

Le fichier existe. Quatre ajouts au service `web`, et un bloc `networks` en bas.
**Rien à changer d'autre** — le port, le `mem_limit`, le `logging`, le
`pull_policy` et le healthcheck restent tels quels.

| Ajout | Valeur | Pourquoi |
| --- | --- | --- |
| `environment.DATABASE_URL` | `postgresql://typio:${MDP_TYPIO}@db:5432/typio` | `db` désigne ici `carte-db-1`, joint par le réseau externe |
| `networks` (sur `web`) | `default` **et** `carte` | il lui faut les deux |
| `networks.carte` (en bas) | `external: true`, `name: carte_default` | créé par la stack `carte`, pas par celle-ci |
| `infra/.env` | `MDP_TYPIO=...` | **n'existe pas aujourd'hui** : `TYPIO_TAG` vient d'un `export` dans `deployer.sh` |

### Ce qui ne change PAS, et il faut y résister

- **Pas de nouveau port.** Typio publie déjà `127.0.0.1:8018:3000`. 8019 reste
  libre pour autre chose.
- **Pas de service `db` ici.** C'est tout l'objet du partage.
- **Pas de `build:`.** Le VPS tire l'image, il ne la construit pas. Ajouter un
  `build:` « au cas où » rendrait possible un `docker compose up --build` qui
  tuerait la base PostgreSQL de la famille par OOM.

### Le fichier `.env` du VPS

`infra/` n'a aujourd'hui aucun `.env`. En ajouter un implique :

- un `infra/.env.example` **dans git**, avec `MDP_TYPIO=` vide ;
- le `infra/.env` réel sur le serveur uniquement, **jamais** commité ;
- vérifier que `.gitignore` couvre bien `infra/.env`.

**Ajout du 5 octobre 2026, connexion GitHub et Discord.** Le service `web` reçoit aussi
`APP_ORIGIN` (par défaut `https://typio.aether-manager.ca`), `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET`, lus dans le même
`infra/.env`. Toutes sont facultatives (`${VAR:-}`) : un fournisseur sans identifiants
garde son bouton désactivé au lieu d'empêcher le démarrage. Les secrets sont ceux des
applications OAuth **de production**, distinctes de celles du développement.

## Le point que j'avais manqué : les migrations

**Le VPS ne construit pas l'image, et l'image ne contient pas de quoi migrer.**
C'est le vrai travail de ce chantier, et il n'apparaît dans aucun des fichiers
compose.

Le `Dockerfile` utilise `output: "standalone"` de Next : l'étape `runner` ne
reçoit que le serveur compilé et ses dépendances tracées. **Un CLI de migration
— `prisma migrate`, `drizzle-kit` — n'y est pas**, à moins de l'y copier
explicitement. Et `package.json` ne déclare aujourd'hui aucune dépendance base de
données : le choix du client reste entier.

Trois options, et leurs défauts :

| Option | Défaut |
| --- | --- |
| Migrer au démarrage du conteneur (entrypoint) | rejoué à chaque redémarrage ; une migration qui échoue bloque le démarrage, et `deployer.sh` dira seulement « pas healthy » |
| `docker compose run --rm web <migrate>` | demande que le CLI soit dans l'image `runner` |
| Une image de migration séparée | un second artefact à construire, publier et versionner |

**Recommandation : la deuxième**, avec une étape explicite dans `deployer.sh`
avant le `up -d`. Concrètement :

1. Copier le CLI de migration et les fichiers de migration dans l'étape `runner`
   du `Dockerfile` (quelques lignes, l'image grossit peu).
2. Ajouter dans `deployer.sh`, entre `docker compose pull web` et
   `docker compose up -d web`, un appel de migration qui **arrête le déploiement
   sur échec** et affiche le journal.

Cette forme colle à la philosophie déjà écrite dans `deployer.sh` : il attend
l'état `healthy`, et il vide le journal quand ça rate plutôt que d'annoncer un
succès. Une migration silencieuse serait le contraire.

### Le pool de connexions

`carte-db-1` est à 23 connexions sur 100. Typio en ajoutera. **Plafonner le pool
à 5** : la machine a un seul vCPU, et chaque backend PostgreSQL est un processus.
Un pool par défaut de 10 ou 20 ne servirait à rien ici et grignoterait la marge
des sept API de la famille.

## La base à créer à la main sur le VPS

**Ajouter `MDP_TYPIO` au compose de `carte` ne suffira pas.** Le script
`/srv/carte/infra/init-db/01-bases.sh` ne s'exécute qu'à la naissance du volume,
et il le dit lui-même :

> Ajouter une appli plus tard : `docker compose exec db psql -U postgres` puis
> les deux mêmes lignes. Ce script ne rejoue pas sur un volume existant.

Il faut donc créer le rôle et la base manuellement, une fois :

```
docker exec -it carte-db-1 psql -U postgres
```

```sql
CREATE ROLE typio LOGIN PASSWORD 'celui de infra/.env';
CREATE DATABASE typio OWNER typio;
REVOKE ALL ON DATABASE typio FROM PUBLIC;
```

Trois points de méthode :

1. **Le mot de passe doit être identique** à `MDP_TYPIO` dans `/srv/typio/infra/.env`.
2. **Ajouter quand même la ligne** `creer typio "${MDP_TYPIO:-}"` dans
   `/srv/carte/infra/init-db/01-bases.sh`, et `MDP_TYPIO` au `.env` de `carte`.
   Ça ne servira pas aujourd'hui, mais le jour où le volume est recréé, ça évite
   une base manquante découverte trop tard.
3. **Le rôle reste non-superuser.** C'est ce qui fait tenir le cloisonnement
   décrit plus bas — ne pas lui donner `CREATEDB` ni `CREATEROLE` par confort.
   Attention : une migration qui voudrait créer une extension (`CREATE EXTENSION
   pg_trgm`, par exemple) échouera. Si c'est nécessaire, créer l'extension une
   fois en tant que `postgres`, pas élargir les droits du rôle.

## Le mode d'emploi du correcteur

À livrer dans le `README.md`, en français, sans jargon d'infrastructure. Le
correcteur n'a pas à savoir qu'un VPS existe.

**Prérequis** : Docker Desktop (Windows, macOS) ou Docker Engine avec le plugin
Compose (Linux). Rien d'autre — ni Bun, ni Node, ni PostgreSQL, ni fichier à
créer.

**La commande** : `docker compose up --build`, puis ouvrir
`http://localhost:3000`.

Le premier lancement construit l'image et télécharge PostgreSQL : quelques
minutes. Les suivants démarrent en secondes.

| Besoin | Commande |
| --- | --- |
| Arrêter | `Ctrl+C`, ou `docker compose down` |
| Repartir d'une base vide | `docker compose down -v` |

### Les trois erreurs à anticiper dans le README

| Message | Cause | Correctif à documenter |
| --- | --- | --- |
| `port is already allocated` | 3000 déjà pris (un `next dev` qui traîne) | changer le premier nombre de `ports` : `"3001:3000"` |
| `Cannot connect to the Docker daemon` | Docker Desktop n'est pas lancé | démarrer Docker Desktop et attendre qu'il soit vert |
| build très lent ou tué | le `next build` réclame ~1 Go | allouer au moins 2 Go à Docker Desktop (Settings → Resources) |

Les deux premières ne sont pas théoriques : elles se sont produites pendant la
préparation de ce document.

## Ce que le partage de PostgreSQL coûte vraiment

**Les données sont cloisonnées. Le sort ne l'est pas.** Les deux phrases sont
vraies en même temps, et seule la première est rassurante.

### L'isolation des données tient — trois verrous

1. **Aucun rôle projet n'a de pouvoir.** `rolsuper`, `rolcreatedb`,
   `rolcreaterole` sont tous à `f` pour les sept rôles existants. Seul
   `postgres` est superuser.
2. **Le mot de passe est exigé sur le réseau Docker.** La dernière ligne de
   `pg_hba.conf` est `host all all all scram-sha-256`. Les lignes `trust`
   au-dessus ne couvrent que le socket Unix *à l'intérieur* du conteneur et son
   propre `127.0.0.1` — pas la loopback de l'hôte, pas le réseau Docker.
3. **`REVOKE ALL ON DATABASE ... FROM PUBLIC`** à la création. Combiné à des
   rôles non-superuser, un rôle ne peut pas ouvrir une base dont il n'est pas
   propriétaire.

### Le sort devient commun — trois conséquences

Aujourd'hui Typio a son propre réseau et ne dépend de rien. **Le rejoindre à
`carte_default` change ça**, définitivement :

| Événement | Conséquence |
| --- | --- |
| Le conteneur `carte-db-1` redémarre | Typio tombe **et** les huit applis de la famille tombent |
| `docker compose down` dans `/srv/carte/infra` | emporte la base de Typio |
| Une requête lourde de Typio | prend le seul vCPU ; `budget` et les autres ralentissent |

C'est acceptable, mais c'est un choix à faire les yeux ouverts, pas un détail de
configuration. **Si Typio doit survivre indépendamment de la famille**, la bonne
réponse n'est pas un second PostgreSQL sur cette machine — c'est un vCPU de plus
(le goulot réel), ou SQLite si la charge est légère.

## Ce qui a été vérifié, et ce qui ne l'a pas été

Tout ce qui précède vient de mesures prises sur le VPS le 2 octobre 2026, sauf
les deux points listés en bas.

### Vérifié de première main

| Quoi | Comment |
| --- | --- |
| RAM, swap, PSI, load, uptime, OOM | `free`, `/proc/pressure/*`, `/proc/vmstat`, `dmesg` |
| RAM et CPU par conteneur et par service | `docker stats`, `systemctl show -p MemoryCurrent` |
| Les 7 bases et leur taille | `psql \l+` |
| `max_connections`, `shared_buffers`, connexions ouvertes | `SHOW`, `pg_stat_activity` |
| Absence de superuser sur les rôles projet | `pg_roles` |
| `pg_hba.conf` | lu dans le conteneur |
| Composition des réseaux Docker | `docker network inspect` |
| Le script `init-db` de `carte` et sa mise en garde | lu dans `/srv/carte/infra` |
| Port 8018, `pull_policy`, `mem_limit`, healthcheck de Typio | lus dans `infra/docker-compose.yml` |
| Absence de CLI de migration dans l'image | lu dans le `Dockerfile` (`output: standalone`, étape `runner`) |
| Absence de dépendance base de données | `package.json` |

### Non vérifié — à confirmer avant de livrer

1. **Aucun `docker compose up` réel n'a été lancé.** Docker Desktop n'était pas
   démarré sur le poste de travail. Seule la *syntaxe* d'un compose de ce type a
   été validée — `docker compose config` est purement client et ne touche pas au
   démon. **Faire tourner un `up --build` réel sur une machine vierge avant de
   livrer au prof**, en chronométrant le premier build : c'est ce chiffre qu'il
   faut écrire dans le README, pas « quelques minutes ».

2. **La connexion croisée entre bases n'a pas été testée en vrai.** La lecture du
   mot de passe de production dans le `.env` de `carte` a été refusée.
   L'isolation est établie par la *configuration* (non-superuser + `REVOKE` +
   `scram-sha-256`), ce qui est solide, mais pas par une tentative réelle. Le
   test, à lancer par quelqu'un qui a accès au `.env` :

   ```
   MDP=$(grep "^MDP_BUDGET=" /srv/carte/infra/.env | cut -d= -f2-)
   docker exec -e PGPASSWORD="$MDP" carte-db-1 psql -U budget -d projets -c "SELECT 1"
   ```

   Résultat attendu : `permission denied for database "projets"`. Tout autre
   résultat invalide la section précédente.

## L'ordre des opérations

1. Choisir le client SQL et l'ajouter à `package.json`.
2. Créer `docker-compose.yml` à la racine (local), le faire tourner, chronométrer.
3. Copier le CLI de migration dans l'étape `runner` du `Dockerfile`.
4. Créer le rôle et la base `typio` dans `carte-db-1`.
5. Créer `/srv/typio/infra/.env` avec `MDP_TYPIO`, et `infra/.env.example` dans git.
6. Compléter `infra/docker-compose.yml` (DATABASE_URL, networks).
7. Ajouter l'étape de migration dans `deployer.sh`, avec arrêt sur échec.
8. Déployer, et vérifier que les sept API de `carte` répondent toujours.
