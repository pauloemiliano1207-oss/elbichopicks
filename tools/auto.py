"""El Bicho Picks · tareas automáticas sin intervención (corre en GitHub Actions).
Fuentes gratis y sin clave: ESPN (tablas, resultados, calendario, goles con minuto) y eloratings.net (selecciones).
Uso:
  python3 tools/auto.py data   <repo>   -> actualiza tools/build_data.txt, tools/stats_fut.txt, tools/nations.txt y data.json
  python3 tools/auto.py extra  <work>   -> escribe <work>/extra.json (partidos de selecciones de CONCACAF sin cuotas, modelo Elo)
  python3 tools/auto.py h1     <picks.json> -> califica las jugadas de primer tiempo con los goles por minuto de ESPN
Si una fuente falla, deja los datos anteriores y lo anota en la salida (nunca inventa datos)."""
import json, re, sys, os, math, subprocess, shutil, tempfile, urllib.request, datetime as dt

UA = {'User-Agent': 'Mozilla/5.0 (elbichopicks bot)'}
MX = dt.timezone(dt.timedelta(hours=-6))  # CDMX (sin horario de verano desde 2022)
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.astimezone(MX).date()

def get(url, raw=False, tries=2):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                b = r.read().decode('utf-8')
                return b if raw else json.loads(b)
        except Exception as e:
            err = e
    raise err

ESPN = 'https://site.api.espn.com/apis'
def scoreboard(sport, lg, dates):
    return get(f'{ESPN}/site/v2/sports/{sport}/{lg}/scoreboard?dates={dates}&limit=500').get('events', [])
def standings(sport, lg):
    return get(f'{ESPN}/v2/sports/{sport}/{lg}/standings')

# ---------- nombres ESPN -> nombres del sitio ----------
LEAGUES = {'epl': 'eng.1', 'laliga': 'esp.1', 'seriea': 'ita.1', 'bund': 'ger.1', 'ligue1': 'fra.1', 'ligamx': 'mex.1'}
ALIAS = {
 'AFC Bournemouth': 'Bournemouth', 'Brighton & Hove Albion': 'Brighton', 'Newcastle United': 'Newcastle', 'Tottenham Hotspur': 'Tottenham',
 'Atlético Madrid': 'Atlético de Madrid', 'Celta Vigo': 'Celta de Vigo', 'Deportivo': 'Deportivo La Coruña',
 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Internazionale': 'Inter',
 '1. FC Union Berlin': 'Union Berlin', 'Bayern Munich': 'Bayern Múnich', 'Borussia Mönchengladbach': "Borussia M'gladbach", 'FC Augsburg': 'Augsburg',
 'FC Cologne': 'Colonia', 'Hamburg SV': 'Hamburgo', 'SC Freiburg': 'Freiburg', 'SC Paderborn 07': 'Paderborn', 'SV Elversberg': 'Elversberg',
 'TSG Hoffenheim': 'Hoffenheim', 'VfB Stuttgart': 'Stuttgart',
 'AJ Auxerre': 'Auxerre', 'AS Monaco': 'Monaco', 'Le Havre AC': 'Le Havre', 'Paris Saint-Germain': 'PSG', 'Stade Rennais': 'Rennes',
 'Atlético de San Luis': 'Atlético San Luis', 'FC Juárez': 'Juárez', 'Pumas UNAM': 'Pumas', 'Santos': 'Santos Laguna', 'Tigres UANL': 'Tigres',
}
def nm(x): return ALIAS.get(x, x)

def cdmx(iso):
    return dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(MX)

def months(back=6, fwd=1):
    y, m = TODAY.year, TODAY.month; out = []
    for k in range(-back, fwd + 1):
        mm = m + k; yy = y + (mm - 1) // 12; mm = (mm - 1) % 12 + 1; out.append(f'{yy}{mm:02d}')
    return out

# =====================================================================================
def cmd_data(repo):
    log = []
    bd_p = os.path.join(repo, 'tools/build_data.txt'); st_p = os.path.join(repo, 'tools/stats_fut.txt'); na_p = os.path.join(repo, 'tools/nations.txt')
    bd = open(bd_p, encoding='utf-8').read(); stats_old = open(st_p, encoding='utf-8').read(); nat = open(na_p, encoding='utf-8').read()
    # equipos del sitio por liga: nombre -> abreviatura
    fut = bd[bd.index('FUT = {'):bd.index('# ventaja extra')]
    OUR = {}
    for mm in re.finditer(r'"(\w+)": \{"name"', fut):
        seg = fut[mm.end():].split('"teams":[', 1)[1].split(']}', 1)[0]
        OUR[mm.group(1)] = dict(re.findall(r'\("([^"]+)","(\w+)"', seg))
    results, upcoming = [], {}
    new_stats = {}
    for key, code in LEAGUES.items():
        try:
            S = standings('soccer', code); ent = S['children'][0]['standings']['entries']
            evs = []
            for m in months(): evs += scoreboard('soccer', code, m)
            ab = OUR[key]; miss = set()
            table = {}
            for e in ent:
                n = nm(e['team']['displayName']); s = {x['name']: x.get('value') for x in e['stats']}
                if n not in ab: miss.add(n); continue
                table[n] = dict(w=int(s['wins']), d=int(s['ties']), l=int(s['losses']), gf=int(s['pointsFor']), ga=int(s['pointsAgainst']))
            if miss: log.append(f'{key}: equipos sin mapear {sorted(miss)} (se conservan datos anteriores)')
            if len(table) < len(ab) * 0.8: raise RuntimeError(f'solo {len(table)} de {len(ab)} equipos')
            # tabla en build_data
            for n, t in table.items():
                a = ab[n]
                if key == 'ligamx':
                    bd, k = re.subn(r'\("%s","%s",\d+,\d+,\d+,\(\d+,\d+\)' % (re.escape(n), a), f'("{n}","{a}",{t["w"]},{t["d"]},{t["l"]},({t["gf"]},{t["ga"]})', bd)
                else:
                    bd, k = re.subn(r'\("%s","%s",\d+,\d+,\d+' % (re.escape(n), a), f'("{n}","{a}",{t["w"]},{t["d"]},{t["l"]}', bd)
            # local / visitante y forma a partir de los partidos terminados
            sp = {n: dict(hp=0, hgf=0, hga=0, ap=0, agf=0, aga=0, f=[]) for n in table}
            seen = set()
            for e in sorted(evs, key=lambda e: e['date']):
                if e['id'] in seen: continue
                seen.add(e['id']); c = e['competitions'][0]; t = {x['homeAway']: x for x in c['competitors']}
                hn, an = nm(t['home']['team']['displayName']), nm(t['away']['team']['displayName'])
                if e['status']['type'].get('completed') and t['home'].get('score') not in (None, ''):
                    hs, as_ = int(float(t['home']['score'])), int(float(t['away']['score']))
                    if hn in sp: sp[hn]['hp'] += 1; sp[hn]['hgf'] += hs; sp[hn]['hga'] += as_; sp[hn]['f'].append('G' if hs > as_ else 'E' if hs == as_ else 'P')
                    if an in sp: sp[an]['ap'] += 1; sp[an]['agf'] += as_; sp[an]['aga'] += hs; sp[an]['f'].append('G' if as_ > hs else 'E' if hs == as_ else 'P')
                    d = cdmx(e['date']).date()
                    if (TODAY - d).days <= 8 and hn in ab and an in ab:
                        results.append((key, d.isoformat(), ab[hn], ab[an], hs, as_))
                elif e['status']['type'].get('state') == 'pre' and key != 'ligamx':
                    t0 = cdmx(e['date'])
                    if 0 <= (t0.date() - TODAY).days <= 7 and hn in ab and an in ab:
                        upcoming.setdefault(key, []).append((t0.strftime('%Y-%m-%d %H:%M'), ab[hn], ab[an], None, None, None))
            new_stats[key] = [(n, table[n], sp[n]) for n in table]
            log.append(f'{key}: tabla {len(table)} equipos, {len(seen)} partidos')
        except Exception as ex:
            log.append(f'{key}: ERROR {ex} (se conserva lo anterior)')
    # stats_fut.txt: se reescribe por liga; las ligas que fallaron conservan sus líneas
    old = {}; lg = None
    for ln in stats_old.splitlines():
        if ln.startswith('['): lg = ln[1:-1]; old[lg] = []; continue
        if lg and ln.strip() and not ln.startswith('#'): old[lg].append(ln)
    out = [f'# Estadísticas por equipo (fuente: ESPN, actualizado automáticamente el {TODAY.isoformat()})',
           '# Equipo | GF GC | PJ_local GF_local GC_local | PJ_visita GF_visita GC_visita | Forma (últimos 5, el más reciente al final)']
    for key in LEAGUES:
        out.append(f'[{key}]')
        if key in new_stats:
            for n, t, s in new_stats[key]:
                out.append(f"{n}|{t['gf']} {t['ga']}|{s['hp']} {s['hgf']} {s['hga']}|{s['ap']} {s['agf']} {s['aga']}|{''.join(s['f'][-5:]) or 'E'}")
        else: out += old.get(key, [])
    stats_new = '\n'.join(out) + '\n'
    # NBA
    try:
        S = standings('basketball', 'nba'); rows = []
        for ch in S['children']:
            conf = 'Este' if 'East' in ch['name'] else 'Oeste'
            for e in ch['standings']['entries']:
                s = {x['name']: x.get('value') for x in e['stats']}; rows.append((e['team']['displayName'], int(s['wins']), int(s['losses']), conf))
        if len(rows) == 30: bd = re.sub(r'NBA_REC = \[.*?\]\n', 'NBA_REC = ' + repr(rows) + '\n', bd, count=1, flags=re.S); log.append('nba: ok')
    except Exception as ex: log.append(f'nba: ERROR {ex}')
    # NFL
    NFL_AB = dict(re.findall(r"\('([^']+)', '(\w+)'", bd[bd.index('NFL_REC'):bd.index('NFL_REC') + 4000]))
    try:
        S = standings('football', 'nfl'); rows = []
        for ch in S['children']:
            conf = 'AFC' if 'American' in ch['name'] else 'NFC'
            for e in ch['standings']['entries']:
                n = e['team']['displayName']; s = {x['name']: x.get('value') for x in e['stats']}
                if n in NFL_AB: rows.append((n, NFL_AB[n], int(s['wins']), int(s['losses']), round(float(s['winPercent']), 3), conf))
        if len(rows) == 32:
            bd = re.sub(r'NFL_REC = \[.*?\]\n', 'NFL_REC = [' + ',\n '.join(repr(r) for r in rows) + ']\n', bd, count=1, flags=re.S); log.append('nfl: ok')
        else: log.append(f'nfl: solo {len(rows)} equipos, se conserva')
        # resultados y próximos NFL
        for k in range(-8, 8):
            d = TODAY + dt.timedelta(days=k)
            for e in scoreboard('football', 'nfl', d.strftime('%Y%m%d')):
                c = e['competitions'][0]; t = {x['homeAway']: x for x in c['competitors']}
                hn, an = t['home']['team']['displayName'], t['away']['team']['displayName']
                if hn not in NFL_AB or an not in NFL_AB: continue
                t0 = cdmx(e['date'])
                if e['status']['type'].get('completed') and k <= 0:
                    results.append(('nfl', t0.date().isoformat(), NFL_AB[hn], NFL_AB[an], int(float(t['home']['score'])), int(float(t['away']['score']))))
                elif e['status']['type'].get('state') == 'pre' and k >= 0:
                    upcoming.setdefault('nfl', []).append((t0.strftime('%Y-%m-%d %H:%M'), NFL_AB[hn], NFL_AB[an], None, None, None))
    except Exception as ex: log.append(f'nfl: ERROR {ex}')
    results = sorted(set(results), key=lambda r: (r[1], r[0]))
    for k in upcoming: upcoming[k] = sorted(set(upcoming[k]))
    if results:
        bd = re.sub(r'RESULTS = \[.*?\n\]\n', 'RESULTS = [\n' + ''.join(f' {r!r},\n' for r in results) + ']\n', bd, count=1, flags=re.S)
    if upcoming:
        bd = re.sub(r'U = \{.*?\n\}\n', 'U = {\n' + ''.join(f' {k!r}:{v!r},\n' for k, v in upcoming.items()) + '}\n', bd, count=1, flags=re.S)
    bd = re.sub(r'UPDATED = "[\d-]+"', f'UPDATED = "{TODAY.isoformat()}"', bd, count=1)
    # Elo de selecciones
    try:
        rows = [l.split('\t') for l in get('https://www.eloratings.net/World.tsv', raw=True).strip().splitlines()]
        raw = '|'.join(f'{r[0]}, {r[2]}, {r[3]}' for r in rows if len(r) > 3 and r[3].isdigit())
        if raw.count('|') > 150:
            nat = re.sub(r'ELO_RAW = """.*?"""', 'ELO_RAW = """' + raw + '"""', nat, count=1, flags=re.S)
            nat = re.sub(r'ELO_DATE = "[\d-]+"', f'ELO_DATE = "{TODAY.isoformat()}"', nat, count=1); log.append('elo: ok')
    except Exception as ex: log.append(f'elo: ERROR {ex}')
    # construir y probar en una carpeta aparte; solo se guarda si TODAS las pruebas pasan
    W = tempfile.mkdtemp()
    for src, dst in [('tools/model.txt', 'model.py'), ('data.json', 'data.json'), ('tools/tests.txt', 'tests.py')]: shutil.copy(os.path.join(repo, src), os.path.join(W, dst))
    open(os.path.join(W, 'build_data.py'), 'w', encoding='utf-8').write(bd)
    open(os.path.join(W, 'stats_fut.txt'), 'w', encoding='utf-8').write(stats_new)
    open(os.path.join(W, 'nations.py'), 'w', encoding='utf-8').write(nat)
    prev_track = len(json.load(open(os.path.join(repo, 'data.json'))).get('track', []))
    r1 = subprocess.run([sys.executable, 'build_data.py'], cwd=W, capture_output=True, text=True)
    r2 = subprocess.run([sys.executable, 'tests.py'], cwd=W, capture_output=True, text=True) if r1.returncode == 0 else None
    ok = r1.returncode == 0 and r2 and r2.returncode == 0
    if ok:
        new_track = len(json.load(open(os.path.join(W, 'data.json'))).get('track', []))
        if new_track < prev_track: ok = False; log.append(f'track bajó de {prev_track} a {new_track}: no se publica')
    if ok:
        shutil.copy(os.path.join(W, 'data.json'), os.path.join(repo, 'data.json'))
        open(bd_p, 'w', encoding='utf-8').write(bd); open(st_p, 'w', encoding='utf-8').write(stats_new); open(na_p, 'w', encoding='utf-8').write(nat)
        log.append('data.json: actualizado y pruebas OK')
    else:
        log.append('data.json: NO se actualizó. ' + (r1.stderr[-800:] if r1.returncode else (r2.stdout[-800:] + r2.stderr[-400:] if r2 else '')))
    print('\n'.join(log)); return ok

# =====================================================================================
NAT_COMPS = {'concacaf.nations.league': 'Concacaf Nations League', 'fifa.worldq.concacaf': 'Eliminatoria Concacaf', 'concacaf.gold': 'Copa Oro',
             'fifa.friendly': 'Amistoso internacional'}
def cmd_extra(work, repo):
    nat = open(os.path.join(repo, 'tools/nations.txt'), encoding='utf-8').read()
    NAT = {m[3]: (m[0], m[1]) for m in re.findall(r'"(\w\w)":\("([^"]+)","(\w+)","[^"]+","(\w+)"\)', nat)}  # abrev3 -> (código Elo, nombre)
    ELO = {c: int(r) for _, c, r in re.findall(r'(\d+), (\w+), (\d+)', nat.split('ELO_RAW = """', 1)[1].split('"""', 1)[0])}
    out = []
    for slug, lgname in NAT_COMPS.items():
        for k in range(0, 3):
            d = (TODAY + dt.timedelta(days=k)).strftime('%Y%m%d')
            try: evs = scoreboard('soccer', slug, d)
            except Exception: continue
            for e in evs:
                if e['status']['type'].get('state') != 'pre': continue
                t0 = dt.datetime.fromisoformat(e['date'].replace('Z', '+00:00'))
                if not (NOW < t0 < NOW + dt.timedelta(hours=48)): continue
                c = e['competitions'][0]; t = {x['homeAway']: x for x in c['competitors']}
                h, a = NAT.get(t['home']['team'].get('abbreviation')), NAT.get(t['away']['team'].get('abbreviation'))
                if not h or not a or h[0] not in ELO or a[0] not in ELO: continue
                if slug == 'fifa.friendly' and not ({h[0], a[0]} & {'MX', 'US', 'CA'}): continue
                neutral = bool(c.get('neutralSite'))
                dr = ELO[h[0]] - ELO[a[0]] + (0 if neutral else 100)
                lh, la = 1.3 * math.exp(0.0035 * dr / 2), 1.3 * math.exp(-0.0035 * dr / 2)
                note = (c.get('notes') or [{}])[0].get('headline', '') if c.get('notes') else ''
                out.append({'id': 'espn-' + str(e['id']), 'lg': lgname, 't': t0.strftime('%Y-%m-%dT%H:%M:%SZ'), 'h': h[1], 'a': a[1],
                            'lh': round(lh, 2), 'la': round(la, 2),
                            'note': (note + '. ' if note else '') + ('Cancha neutral. ' if neutral else '') + 'Sin cuotas en nuestras fuentes: modelo Elo de selecciones, aún sin validar contra casas.'})
    seen = set(); out = [x for x in out if not (x['id'] in seen or seen.add(x['id']))]
    json.dump(out, open(os.path.join(work, 'extra.json'), 'w'), ensure_ascii=False)
    print(f'selecciones: {len(out)} partidos')

# =====================================================================================
H1_LG = {'Premier League': 'eng.1', 'LaLiga': 'esp.1', 'Serie A': 'ita.1', 'Bundesliga': 'ger.1', 'Ligue 1': 'fra.1', 'Liga MX': 'mex.1', 'Champions League': 'uefa.champions', 'UEFA Nations League': 'uefa.nations'}
def h1_goals(c):
    n = 0
    for d in c.get('details') or []:
        if not d.get('scoringPlay'): continue
        dv = (d.get('clock') or {}).get('displayValue', '')
        mm = re.match(r"(\d+)'", dv)
        if mm and int(mm.group(1)) <= 45: n += 1
    return n
def g1t(k, n):
    if k == 'Gol en el 1er tiempo': return 'win' if n >= 1 else 'loss'
    if k == 'Más de 1.5 goles en el 1er tiempo': return 'win' if n >= 2 else 'loss'
    if k == '1er tiempo sin goles': return 'win' if n == 0 else 'loss'
    return None
def cmd_h1(path):
    P = json.load(open(path)); cache = {}; n = 0
    for p in P['picks']:
        r = p.get('res')
        if not r or r.get('void') or 'h1' in r or p['lg'] not in H1_LG: continue
        if not any(x['fam'] == '1t' and x.get('g') is None for x in [p['key']] + p['top']): continue
        t = dt.datetime.fromisoformat(p['t'].replace('Z', '+00:00'))
        found = None
        for d in {(t - dt.timedelta(hours=8)).strftime('%Y%m%d'), t.strftime('%Y%m%d')}:
            kk = (H1_LG[p['lg']], d)
            if kk not in cache:
                try: cache[kk] = scoreboard('soccer', *kk)
                except Exception: cache[kk] = []
            for e in cache[kk]:
                te = dt.datetime.fromisoformat(e['date'].replace('Z', '+00:00'))
                c = e['competitions'][0]; sc = {x['homeAway']: x.get('score') for x in c['competitors']}
                if abs((te - t).total_seconds()) <= 2700 and e['status']['type'].get('completed') and str(sc.get('home')) == str(r['hs']) and str(sc.get('away')) == str(r['as']):
                    found = c
        if found is None: continue
        h = h1_goals(found); r['h1'] = h
        for x in [p['key']] + p['top']:
            if x['fam'] == '1t': x['g'] = g1t(x['k'], h)
        n += 1
    json.dump(P, open(path, 'w'), ensure_ascii=False)
    print(f'primer tiempo: {n} partidos calificados')

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'data': sys.exit(0 if cmd_data(sys.argv[2]) else 1)
    if c == 'extra': cmd_extra(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '.')
    if c == 'h1': cmd_h1(sys.argv[2])
