#!/usr/bin/env bash
# El Bicho Picks · actualización de la tarde: NBA y Liga MX, con cuotas más cercanas al partido (2-4 créditos).
set -u
cd "$(dirname "$0")/.."
R=$(pwd); W=$(mktemp -d)
if [ -z "${ODDS_API_KEY:-}" ]; then echo "Falta ODDS_API_KEY"; exit 0; fi
cp sys/daily.txt "$W/bicho_daily.py"; cp sys/build_odds.txt "$W/bicho_build_odds.py"; cp sys/build_today.txt "$W/bicho_build_today.py"
cp sys/picks_mod.txt "$W/bicho_picks.py"; cp sys/senales.json "$W/bicho_senales.json"; cp sys/picks.json "$W/picks.json"; cp today.json "$W/prev_today.json"; cp sys/extra.json "$W/extra.json"
BICHO_ONLY=basketball_nba,soccer_mexico_ligamx python3 "$W/bicho_daily.py" "$ODDS_API_KEY" "${APIFY_TOKEN:-sin_token_apify_en_la_tarde_0000}" "$W"
[ -s "$W/today.json" ] && cp "$W/today.json" today.json
cp "$W/picks.json" sys/picks.json
if grep -rlF -e "$ODDS_API_KEY" --exclude-dir=.git . ; then echo "¡Clave encontrada! No se publica."; git checkout -- .; exit 1; fi
python3 tools/aviso.py "$R" --nba || true
