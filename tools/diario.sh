#!/usr/bin/env bash
# El Bicho Picks · actualización diaria automática (GitHub Actions). No contiene claves: llegan como variables secretas.
set -u
cd "$(dirname "$0")/.."
R=$(pwd); W=$(mktemp -d)
echo "== 1) Tablas, récord y Elo (ESPN + eloratings) =="
python3 tools/auto.py data "$R" || echo "AVISO: data.json se queda como estaba"
if [ -z "${ODDS_API_KEY:-}" ] || [ -z "${APIFY_TOKEN:-}" ]; then echo "Faltan las claves secretas ODDS_API_KEY / APIFY_TOKEN en GitHub: solo se actualizaron tablas."; exit 0; fi
echo "== 2) Cuotas, partidos de hoy, alineaciones e historial =="
cp sys/daily.txt "$W/bicho_daily.py"; cp sys/build_odds.txt "$W/bicho_build_odds.py"; cp sys/build_today.txt "$W/bicho_build_today.py"
cp sys/picks_mod.txt "$W/bicho_picks.py"; cp sys/senales.json "$W/bicho_senales.json"; cp sys/picks.json "$W/picks.json"; cp today.json "$W/prev_today.json"
python3 tools/auto.py extra "$W" "$R" || echo '[]' > "$W/extra.json"
python3 "$W/bicho_daily.py" "$ODDS_API_KEY" "$APIFY_TOKEN" "$W"
python3 tools/auto.py h1 "$W/picks.json" || true
for f in odds.json today.json lineups.json; do [ -s "$W/$f" ] && cp "$W/$f" "$R/$f"; done
cp "$W/bicho_senales.json" sys/senales.json; cp "$W/picks.json" sys/picks.json; cp "$W/extra.json" sys/extra.json
echo "== 3) Revisión de seguridad =="
if grep -rlF -e "$ODDS_API_KEY" -e "$APIFY_TOKEN" --exclude-dir=.git . ; then echo "¡Clave encontrada en archivos! No se publica."; git checkout -- .; exit 1; fi
echo "OK"
