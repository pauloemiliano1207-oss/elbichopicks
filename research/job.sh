#!/usr/bin/env bash
# Laboratorio: se corre en GitHub Actions. Solo se guardan resultados (no los datos crudos).
set -u; mkdir -p research/out; D=$(mktemp -d)
curl -sfL --max-time 120 -o $D/nba.csv "https://huggingface.co/datasets/group-a/Final_Project/resolve/main/NBA/NBA_ODDS.csv"; echo "hf: $?  $(wc -l < $D/nba.csv 2>/dev/null) líneas" > research/out/probe.txt
head -3 $D/nba.csv >> research/out/probe.txt 2>/dev/null
python3 - "$D/nba.csv" >> research/out/probe.txt <<'PY'
import csv,sys,collections
r=list(csv.DictReader(open(sys.argv[1])))
print('filas',len(r)); print('columnas',list(r[0].keys()))
for k in list(r[0].keys())[:3]: print(k, collections.Counter(x[k][:4] for x in r).most_common(25))
PY
