# syntax=docker/dockerfile:1

# L'image de Typio, construite par GitHub Actions — jamais sur le VPS.
#
# Le VPS n'a que 1,9 Go de RAM, dont la moitié déjà prise par les huit
# conteneurs de « carte », et son swap est entamé. Un `next build` sur place
# réclamerait près d'un gigaoctet : l'OOM killer de Linux choisit alors une
# victime lui-même, et rien ne garantit que ce soit le build plutôt que la
# base PostgreSQL de la famille. Le VPS ne fait donc qu'un `docker pull`.
#
# Trois étapes plutôt qu'une : les dépendances, la compilation, puis l'image
# finale qui ne garde que le serveur compilé. Les outils de build ne partent
# pas en production.

# ── 1. Les dépendances ──────────────────────────────────────────────────────
# Étape séparée pour que Docker la garde en cache : tant que package.json et
# bun.lock ne changent pas, `bun install` n'est pas rejoué, même quand tout le
# reste du code a changé.
FROM oven/bun:1.4.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# --frozen-lockfile : si bun.lock ne correspond plus à package.json, la
# construction échoue au lieu d'installer des versions que personne n'a
# testées.
RUN bun install --frozen-lockfile

# ── 2. La compilation ───────────────────────────────────────────────────────
FROM oven/bun:1.4.1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build
RUN bun run build:realtime

# ── 3. L'image servie ───────────────────────────────────────────────────────
FROM oven/bun:1.4.1-alpine AS runner
WORKDIR /app

# HOSTNAME=0.0.0.0 vaut « toutes les interfaces du conteneur », pas
# « ouvert sur internet » : c'est docker-compose qui décide de l'exposition,
# et il ne publie ce port que sur 127.0.0.1. Sans cette ligne le serveur de
# Next n'écoute que sur localhost *à l'intérieur* du conteneur, donc
# injoignable même par Caddy.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Un utilisateur sans privilèges : si une faille de Next permettait d'exécuter
# du code, elle ne le ferait pas en root.
RUN addgroup --system --gid 1001 typio \
 && adduser --system --uid 1001 --ingroup typio typio

# output: "standalone" a déjà trié les dépendances utiles ; static/ et public/
# ne sont pas recopiés par Next et doivent être ajoutés à la main.
COPY --from=builder --chown=typio:typio /app/.next/standalone ./
COPY --from=builder --chown=typio:typio /app/.next/static ./.next/static
COPY --from=builder --chown=typio:typio /app/public ./public
COPY --from=builder --chown=typio:typio /app/dist/realtime.js ./realtime.js

# Le déploiement lance les migrations explicitement avant de redémarrer le
# serveur. Le bundle standalone ne suit pas un script hors du graphe Next : on
# copie donc le script, les migrations et leurs deux dépendances runtime.
COPY --from=builder --chown=typio:typio /app/scripts ./scripts
COPY --from=builder --chown=typio:typio /app/src/db ./src/db
COPY --from=builder --chown=typio:typio /app/drizzle ./drizzle
COPY --from=builder --chown=typio:typio /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=typio:typio /app/node_modules/postgres ./node_modules/postgres

USER typio
EXPOSE 3000

CMD ["bun", "server.js"]
