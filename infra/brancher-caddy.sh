#!/usr/bin/env bash
#
# Greffe (ou regreffe) le bloc Typio dans le Caddyfile du serveur.
#
#   cd /srv/typio/infra && sudo ./brancher-caddy.sh
#
# Le script est rejouable : il retire d'abord le bloc Typio déjà présent, puis
# réinsère celui de caddy/typio.caddyfile. Lancé deux fois, il ne crée pas
# deux blocs — et un Caddyfile avec deux fois le même domaine ne démarre pas.
#
# Il ne touche à rien d'autre. Le bloc de « carte » et ceux de pilote et
# commandant sont recopiés tels quels, et le Caddyfile d'origine est sauvegardé
# avant toute écriture, selon la convention déjà en place sur ce serveur :
# Caddyfile.avant-typio.<horodatage>.

set -euo pipefail

CADDYFILE=/etc/caddy/Caddyfile
FRAGMENT="$(cd "$(dirname "$0")" && pwd)/caddy/typio.caddyfile"
HORODATAGE="$(date +%Y%m%d-%H%M%S)"
SAUVEGARDE="${CADDYFILE}.avant-typio.${HORODATAGE}"

[[ -r "$FRAGMENT" ]]  || { echo "Fragment introuvable : $FRAGMENT" >&2; exit 1; }
[[ -w "$CADDYFILE" ]] || { echo "Caddyfile non accessible en écriture : $CADDYFILE (lancer en root)" >&2; exit 1; }
command -v caddy >/dev/null || { echo "caddy absent du PATH" >&2; exit 1; }

cp -p "$CADDYFILE" "$SAUVEGARDE"
echo "Sauvegarde : $SAUVEGARDE"

# Le candidat est préparé à côté : le Caddyfile en service n'est remplacé
# qu'une fois la nouvelle version validée. Un Caddyfile invalide empêche Caddy
# de redémarrer, et il sert huit autres domaines.
CANDIDAT="$(mktemp)"
trap 'rm -f "$CANDIDAT"' EXIT

# Retire un bloc Typio déjà greffé (entre les deux marqueurs, inclus), puis
# ajoute le fragment à jour. On teste sur « >>> Typio » et « <<< Typio » sans
# les accents qui suivent : c'est la partie du marqueur qui ne bougera pas.
awk '
  /^# >>> Typio/ { dans = 1 }
  !dans          { print }
  /^# <<< Typio/ { dans = 0 }
' "$SAUVEGARDE" > "$CANDIDAT"

printf '\n\n' >> "$CANDIDAT"
cat "$FRAGMENT" >> "$CANDIDAT"

if ! caddy validate --config "$CANDIDAT" --adapter caddyfile; then
	echo >&2
	echo "Caddyfile candidat invalide : rien n'a été modifié." >&2
	echo "Le fichier en service est intact, et la sauvegarde est $SAUVEGARDE." >&2
	exit 1
fi

cat "$CANDIDAT" > "$CADDYFILE"
caddy fmt --overwrite "$CADDYFILE" >/dev/null 2>&1 || true

# reload, pas restart : les connexions en cours sur les autres domaines ne
# sont pas coupées, et Caddy garde ses certificats.
systemctl reload caddy
echo "Caddy rechargé. Bloc Typio greffé sur typio.aether-manager.ca."
echo
echo "Le certificat Let's Encrypt est demandé au premier appel du domaine."
echo "Pour le suivre :  journalctl -u caddy -n 50 --no-pager"
