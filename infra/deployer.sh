#!/usr/bin/env bash
#
# Déploie Typio sur le VPS.
#
#   cd /srv/typio/infra && ./deployer.sh
#
# Le script ne construit rien : il récupère l'image que GitHub Actions a
# publiée sur GHCR et redémarre le conteneur. C'est délibéré — le VPS n'a pas
# la mémoire pour un `next build`, et l'OOM killer ne choisit pas sa victime
# parmi les seuls processus fautifs. Voir le Dockerfile.
#
# Pour déployer une version précise plutôt que la dernière :
#   TAG=sha-a1b2c3d ./deployer.sh

set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

TAG="${TAG:-latest}"
export TYPIO_TAG="$TAG"

echo "── Image demandée : ghcr.io/patlegrand/typio:${TAG}"

# L'état d'avant, pour pouvoir le nommer si le nouveau conteneur ne démarre pas.
AVANT="$(docker image inspect --format '{{index .RepoDigests 0}}' \
         "ghcr.io/patlegrand/typio:${TAG}" 2>/dev/null || echo "aucune image locale")"
echo "── Version en place : ${AVANT}"

echo "── Récupération de l'image"
docker compose pull web

echo "── Application des migrations PostgreSQL"
docker compose run --rm --no-deps web bun scripts/migrate.ts

echo "── Redémarrage du conteneur"
docker compose up -d web

# `up -d` rend la main dès que Docker a lancé le conteneur, pas quand Next
# répond. Sans cette attente, le script dirait « déployé » sur une application
# qui plante au démarrage.
echo "── Attente de l'état healthy (90 s au plus)"
for _ in $(seq 1 45); do
	ETAT="$(docker inspect --format '{{.State.Health.Status}}' typio-web-1 2>/dev/null || echo inconnu)"
	case "$ETAT" in
		healthy)
			echo
			echo "Typio répond.  https://typio.aether-manager.ca"
			docker compose ps
			exit 0
			;;
		unhealthy)
			echo
			echo "Le conteneur démarre mais ne répond pas. Journal :" >&2
			docker compose logs --tail 40 web >&2
			exit 1
			;;
	esac
	sleep 2
done

echo
echo "Toujours pas healthy après 90 s. Journal :" >&2
docker compose logs --tail 40 web >&2
exit 1
