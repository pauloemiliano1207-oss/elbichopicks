#!/usr/bin/env bash
set -u; mkdir -p research/out; D=$(mktemp -d)
curl -sfL --max-time 120 -o $D/nba.csv "https://huggingface.co/datasets/group-a/Final_Project/resolve/main/NBA/NBA_ODDS.csv"
python3 research/nba.py $D/nba.csv && echo ok
