#!/usr/bin/env bash
# El Bicho Picks · actualización diaria automática (GitHub Actions). No contiene claves: llegan como variables secretas.
# Prueba con claves: 2026-11-24
set -u
cd "$(dirname "$0")/.."
R=$(pwd); W=$(mktemp -d)
echo "== 1) Tablas, récord y Elo (ESPN + eloratings) =="
python3 tools/auto.py data "$R" || echo "AVISO: data.json se queda como estaba"
echo "== 1b) NFL: proyecciones de jugadores (nflverse) =="
N=$(mktemp -d); Y=$(TZ=America/Mexico_City date +%Y); M=$(TZ=America/Mexico_City date +%m); [ "$M" -lt 8 ] && Y=$((Y-1))
B=https://github.com/nflverse/nflverse-data/releases/download
ok=1
for f in "stats_player/stats_player_week_$Y.csv" "stats_player/stats_player_week_$((Y-1)).csv" "schedules/games.csv" "injuries/injuries_$Y.csv"; do
  curl -sfL --max-time 120 -o "$N/$(basename $f)" "$B/$f" || { echo "No se pudo bajar $f"; [ "$f" = "injuries/injuries_$Y.csv" ] || ok=0; }
done
if [ "$ok" = 1 ]; then
  if [ "$(TZ=America/Mexico_City date +%u)" = 2 ]; then  # martes: se recalibra con la temporada anterior y se valida con la actual
    curl -sfL --max-time 120 -o "$N/stats_player_week_$((Y-2)).csv" "$B/stats_player/stats_player_week_$((Y-2)).csv" && \
    (cd "$N" && python3 -I "$R/tools/props.py" fit . "$Y" && cp props_model.json "$R/sys/props_model.json") || echo "Recalibración omitida"
  fi
  python3 tools/props.py build "$N" sys/props_model.json props.json || echo "AVISO: props.json se queda como estaba"
fi
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
