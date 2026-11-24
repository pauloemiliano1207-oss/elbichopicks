"""El Bicho Picks · tareas automáticas sin intervención (corre en GitHub Actions).
Fuentes gratis y sin clave: ESPN (tablas, resultados, calendario, goles con minuto) y eloratings.net (selecciones).
Uso:
  python3 tools/auto.py data   <repo>   -> actualiza tools/build_data.txt, tools/stats_fut.txt, tools/nations.txt y data.json
  python3 tools/auto.py extra  <work>   -> escribe <work>/extra.json (partidos de selecciones de CONCACAF sin cuotas, modelo Elo)
  python3 tools/auto.py h1     <picks.json> -> califica las jugadas de primer tiempo con los goles por minuto de ESPN
Si una fuente falla, deja los datos anteriores y lo anota en la salida (nunca inventa datos)."""
import json, re, sys, os, math, subprocess, shutil, tempfile, urllib.request, datetime as dt, collections

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
# Fuentes que permiten descarga automática: football-data.co.uk (fútbol, con goles al medio tiempo) y nflverse (NFL).
import csv, io, unicodedata
FD = 'https://www.football-data.co.uk'
FD_DIV = {'epl': 'E0', 'laliga': 'SP1', 'seriea': 'I1', 'bund': 'D1', 'ligue1': 'F1'}
FD_ALIAS = {
 'Man City': 'Manchester City', 'Man United': 'Manchester United', "Nott'm Forest": 'Nottingham Forest', 'Hull': 'Hull City', 'Ipswich': 'Ipswich Town',
 'Coventry': 'Coventry City', 'Leeds': 'Leeds United', 'Spurs': 'Tottenham',
 'Ath Bilbao': 'Athletic Club', 'Ath Madrid': 'Atlético de Madrid', 'Betis': 'Real Betis', 'Sociedad': 'Real Sociedad', 'Vallecano': 'Rayo Vallecano',
 'Espanol': 'Espanyol', 'La Coruna': 'Deportivo La Coruña', 'Santander': 'Racing Santander', 'Celta': 'Celta de Vigo', 'Alaves': 'Alavés', 'Malaga': 'Málaga',
 'Bayern Munich': 'Bayern Múnich', 'Dortmund': 'Borussia Dortmund', 'Leverkusen': 'Bayer Leverkusen', "M'gladbach": "Borussia M'gladbach",
 'Ein Frankfurt': 'Eintracht Frankfurt', 'FC Koln': 'Colonia', 'Hamburg': 'Hamburgo', 'Schalke 04': 'Schalke 04', 'Werder Bremen': 'Werder Bremen',
 'Paris SG': 'PSG', 'Paris FC': 'Paris FC', 'St Etienne': 'Saint-Étienne',
 'Club America': 'América', 'America': 'América', 'Atl. San Luis': 'Atlético San Luis', 'San Luis': 'Atlético San Luis', 'Guadalajara Chivas': 'Guadalajara',
 'Chivas': 'Guadalajara', 'U.N.A.M.- Pumas': 'Pumas', 'UNAM': 'Pumas', 'Pumas UNAM': 'Pumas', 'U.A.N.L.- Tigres': 'Tigres', 'Tigres UANL': 'Tigres',
 'Club Tijuana': 'Tijuana', 'Los Angeles Clippers': 'LA Clippers', 'Queretaro': 'Querétaro', 'Leon': 'León', 'Juarez': 'Juárez', 'FC Juarez': 'Juárez', 'Santos': 'Santos Laguna', 'Mazatlan FC': 'Mazatlán',
}
STOP = {'fc', 'cf', 'ac', 'afc', 'sc', 'sv', 'tsg', 'club', 'de', 'and', 'hove', 'albion', 'calcio', 'ssc', 'as', 'us', 'ogc', 'rc', 'stade', 'olympique', 'vfb', 'vfl', '1', 'bc', 'cd', 'ud', 'rcd', 'ca', 'deportivo'}
def norm(x):
    x = unicodedata.normalize('NFKD', x).encode('ascii', 'ignore').decode().lower()
    return {t for t in re.split(r"[\s\.\-'’/]+", x) if t and t not in STOP}
def matcher(names):
    """devuelve f(nombre_externo) -> nombre del sitio o None"""
    names = list(names); N = {n: norm(n) for n in names}
    def f(x):
        if x in names: return x
        if FD_ALIAS.get(x) in names: return FD_ALIAS[x]
        t = norm(x); best = [(len(t & N[n]) / max(1, len(t | N[n])), n) for n in names]
        best.sort(reverse=True)
        if best and best[0][0] >= 0.5 and (len(best) == 1 or best[1][0] < best[0][0]): return best[0][1]
        return None
    return f
def fd_csv(path):
    return list(csv.DictReader(io.StringIO(get(FD + path, raw=True).lstrip('﻿'))))
def fd_date(d):
    dd, mm, yy = d.split('/'); yy = int(yy); yy += 2000 if yy < 100 else 0
    return dt.date(yy, int(mm), int(dd))
def season_code():
    y = TODAY.year if TODAY.month >= 7 else TODAY.year - 1
    return f'{y % 100:02d}{(y + 1) % 100:02d}', dt.date(y, 7, 1)

def soccer_matches(key, ab):
    """partidos terminados de la temporada: (fecha, local, visitante, gl, gv) con nombres del sitio"""
    f = matcher(ab); miss = set(); out = []
    sc, start = season_code()
    if key == 'ligamx':
        rows = fd_csv('/new/MEX.csv')
        for r in rows:
            try: d = fd_date(r['Date'])
            except Exception: continue
            if d < start or r.get('HG', '') == '': continue
            h, a = f(r['Home']), f(r['Away'])
            if not h: miss.add(r['Home'])
            if not a: miss.add(r['Away'])
            if h and a: out.append((d, h, a, int(r['HG']), int(r['AG'])))
    else:
        for r in fd_csv(f'/mmz4281/{sc}/{FD_DIV[key]}.csv'):
            if not r.get('FTHG'): continue
            h, a = f(r['HomeTeam']), f(r['AwayTeam'])
            if not h: miss.add(r['HomeTeam'])
            if not a: miss.add(r['AwayTeam'])
            if h and a: out.append((fd_date(r['Date']), h, a, int(r['FTHG']), int(r['FTAG'])))
    return sorted(out), miss

def cmd_data(repo):
    log = []
    bd_p = os.path.join(repo, 'tools/build_data.txt'); st_p = os.path.join(repo, 'tools/stats_fut.txt'); na_p = os.path.join(repo, 'tools/nations.txt')
    bd = open(bd_p, encoding='utf-8').read(); stats_old = open(st_p, encoding='utf-8').read(); nat = open(na_p, encoding='utf-8').read()
    fut = bd[bd.index('FUT = {'):bd.index('# ventaja extra')]
    OUR = {}
    for mm in re.finditer(r'"(\w+)": \{"name"', fut):
        seg = fut[mm.end():].split('"teams":[', 1)[1].split(']}', 1)[0]
        OUR[mm.group(1)] = dict(re.findall(r'\("([^"]+)","(\w+)"', seg))
    results, upcoming, new_stats = [], {}, {}
    for key in LEAGUES:
        try:
            ab = OUR[key]; M, miss = soccer_matches(key, ab)
            if miss: log.append(f'{key}: nombres sin mapear {sorted(miss)}')
            if key == 'ligamx':  # tabla de fase regular: los primeros 17 partidos de cada equipo (la liguilla no cuenta)
                cnt = collections.Counter(); reg = []
                for m in M:
                    if cnt[m[1]] < 17 and cnt[m[2]] < 17: reg.append(m); cnt[m[1]] += 1; cnt[m[2]] += 1
                TM = reg
            else: TM = M
            T = {n: dict(w=0, d=0, l=0, gf=0, ga=0) for n in ab}
            sp = {n: dict(hp=0, hgf=0, hga=0, ap=0, agf=0, aga=0, f=[]) for n in ab}
            for d, h, a, x, y in TM:
                T[h]['gf'] += x; T[h]['ga'] += y; T[a]['gf'] += y; T[a]['ga'] += x
                if x > y: T[h]['w'] += 1; T[a]['l'] += 1
                elif x < y: T[a]['w'] += 1; T[h]['l'] += 1
                else: T[h]['d'] += 1; T[a]['d'] += 1
            for d, h, a, x, y in M:
                sp[h]['hp'] += 1; sp[h]['hgf'] += x; sp[h]['hga'] += y; sp[h]['f'].append('G' if x > y else 'E' if x == y else 'P')
                sp[a]['ap'] += 1; sp[a]['agf'] += y; sp[a]['aga'] += x; sp[a]['f'].append('G' if y > x else 'E' if x == y else 'P')
                if (TODAY - d).days <= 8: results.append((key, d.isoformat(), ab[h], ab[a], x, y))
            played = sum(1 for t in T.values() if t['w'] + t['d'] + t['l'])
            if played < len(ab) * 0.8: raise RuntimeError(f'solo {played} de {len(ab)} equipos con partidos')
            for n, t in T.items():
                a_ = ab[n]
                if key == 'ligamx':
                    bd = re.sub(r'\("%s","%s",\d+,\d+,\d+,\(\d+,\d+\)' % (re.escape(n), a_), f'("{n}","{a_}",{t["w"]},{t["d"]},{t["l"]},({t["gf"]},{t["ga"]})', bd)
                else:
                    bd = re.sub(r'\("%s","%s",\d+,\d+,\d+' % (re.escape(n), a_), f'("{n}","{a_}",{t["w"]},{t["d"]},{t["l"]}', bd)
            new_stats[key] = [(n, T[n], sp[n]) for n in ab]
            log.append(f'{key}: {len(M)} partidos ({max(m[0] for m in M)} el más reciente)')
        except Exception as ex:
            log.append(f'{key}: ERROR {ex} (se conserva lo anterior)')
    # próximos partidos de fútbol (calendario de football-data)
    try:
        DIV2 = {v: k for k, v in FD_DIV.items()}
        for r in fd_csv('/fixtures.csv'):
            k = DIV2.get(r.get('Div'))
            if not k: continue
            ab = OUR[k]; f = matcher(ab); h, a = f(r['HomeTeam']), f(r['AwayTeam'])
            if not h or not a: continue
            d = fd_date(r['Date']); hh, mi = (r.get('Time') or '15:00').split(':')
            t0 = dt.datetime(d.year, d.month, d.day, int(hh), int(mi), tzinfo=dt.timezone(dt.timedelta(hours=0))).astimezone(MX)  # hora del Reino Unido (aprox.)
            if 0 <= (t0.date() - TODAY).days <= 7: upcoming.setdefault(k, []).append((t0.strftime('%Y-%m-%d %H:%M'), ab[h], ab[a], None, None, None))
    except Exception as ex: log.append(f'calendario fútbol: ERROR {ex}')
    # stats_fut.txt
    old = {}; lg = None
    for ln in stats_old.splitlines():
        if ln.startswith('['): lg = ln[1:-1]; old[lg] = []; continue
        if lg and ln.strip() and not ln.startswith('#'): old[lg].append(ln)
    hdr = [l for l in stats_old.splitlines() if l.startswith('#')]
    out = [f'# Estadísticas por equipo (fuente: football-data.co.uk, actualizado automáticamente el {TODAY.isoformat()})' if new_stats else (hdr[0] if hdr else '#'),
           '# Equipo | GF GC | PJ_local GF_local GC_local | PJ_visita GF_visita GC_visita | Forma (últimos 5, el más reciente al final)']
    for key in LEAGUES:
        out.append(f'[{key}]')
        if key in new_stats:
            for n, t, s in new_stats[key]:
                out.append(f"{n}|{t['gf']} {t['ga']}|{s['hp']} {s['hgf']} {s['hga']}|{s['ap']} {s['agf']} {s['aga']}|{''.join(s['f'][-5:]) or 'E'}")
        else: out += old.get(key, [])
    stats_new = '\n'.join(out) + '\n'
    # NFL con nflverse (récord, resultados y próximos partidos)
    NFL_AB = dict(re.findall(r"\('([^']+)', '(\w+)'", bd[bd.index('NFL_REC'):bd.index('NFL_REC') + 4000]))
    AB2N = {v: k for k, v in NFL_AB.items()}; CONF = {r[1]: r[5] for r in re.findall(r"\('([^']+)', '(\w+)', (\d+), (\d+), ([\d.]+), '(\w+)'\)", bd)}
    try:
        G = list(csv.DictReader(io.StringIO(get('https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv', raw=True))))
        y = TODAY.year if TODAY.month >= 6 else TODAY.year - 1
        rec = {a: [0, 0, 0] for a in AB2N}
        fx = lambda t: 'JAC' if t == 'JAX' else t
        for g in G:
            if int(g['season']) != y or g['game_type'] != 'REG': continue
            h, a = fx(g['home_team']), fx(g['away_team'])
            if h not in AB2N or a not in AB2N: continue
            d = dt.date.fromisoformat(g['gameday'])
            if g['home_score'] not in ('', 'NA'):
                x, z = int(float(g['home_score'])), int(float(g['away_score']))
                if x > z: rec[h][0] += 1; rec[a][1] += 1
                elif x < z: rec[a][0] += 1; rec[h][1] += 1
                else: rec[h][2] += 1; rec[a][2] += 1
                if (TODAY - d).days <= 8: results.append(('nfl', d.isoformat(), h, a, x, z))
            elif 0 <= (d - TODAY).days <= 7:
                hh, mi = (g['gametime'] or '13:00').split(':')
                t0 = dt.datetime(d.year, d.month, d.day, int(hh), int(mi), tzinfo=dt.timezone(dt.timedelta(hours=-5))).astimezone(MX)  # hora del Este
                upcoming.setdefault('nfl', []).append((t0.strftime('%Y-%m-%d %H:%M'), h, a, None, None, None))
        rows = [(AB2N[a], a, w, l, round((w + .5 * t) / max(1, w + l + t), 3), CONF.get(a, 'NFC')) for a, (w, l, t) in rec.items()]
        if sum(w + l for _, _, w, l, _, _ in rows) > 0:
            bd = re.sub(r'NFL_REC = \[.*?\]\n', 'NFL_REC = [' + ',\n '.join(repr(r) for r in rows) + ']\n', bd, count=1, flags=re.S); log.append('nfl: ok (nflverse)')
    except Exception as ex: log.append(f'nfl: ERROR {ex}')
    import ast
    try:  # las ligas que hoy fallaron conservan sus resultados y próximos partidos anteriores
        got = {r[0] for r in results}
        oldR = ast.literal_eval(re.search(r'RESULTS = (\[.*?\n\])\n', bd, flags=re.S).group(1))
        results += [tuple(r) for r in oldR if r[0] not in got]
        oldU = ast.literal_eval(re.search(r'U = (\{.*?\n\})\n', bd, flags=re.S).group(1))
        for k, v in oldU.items():
            if k not in upcoming: upcoming[k] = [tuple(x) for x in v]
    except Exception as ex: log.append(f'aviso al conservar datos anteriores: {ex}')
    results = sorted(set(results), key=lambda r: (r[1], r[0]))
    for k in upcoming: upcoming[k] = sorted(set(upcoming[k]))
    if results:
        bd = re.sub(r'RESULTS = \[.*?\n\]\n', 'RESULTS = [\n' + ''.join(f' {r!r},\n' for r in results) + ']\n', bd, count=1, flags=re.S)
    if upcoming:
        bd = re.sub(r'U = \{.*?\n\}\n', 'U = {\n' + ''.join(f' {k!r}:{v!r},\n' for k, v in upcoming.items()) + '}\n', bd, count=1, flags=re.S)
    if new_stats or results: bd = re.sub(r'UPDATED = "[\d-]+"', f'UPDATED = "{TODAY.isoformat()}"', bd, count=1)
    # Elo de selecciones
    try:
        rows = [l.split('\t') for l in get('https://www.eloratings.net/World.tsv', raw=True).strip().splitlines()]
        raw = '|'.join(f'{r[0]}, {r[2]}, {r[3]}' for r in rows if len(r) > 3 and r[3].isdigit())
        if raw.count('|') > 150:
            nat = re.sub(r'ELO_RAW = """.*?"""', 'ELO_RAW = """' + raw + '"""', nat, count=1, flags=re.S)
            nat = re.sub(r'ELO_DATE = "[\d-]+"', f'ELO_DATE = "{TODAY.isoformat()}"', nat, count=1); log.append('elo: ok')
    except Exception as ex: log.append(f'elo: ERROR {ex}')
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
FD_LG = {'Premier League': 'E0', 'LaLiga': 'SP1', 'Serie A': 'I1', 'Bundesliga': 'D1', 'Ligue 1': 'F1'}
def fd_h1(p, r, cache):
    """goles al medio tiempo desde football-data.co.uk (ligas europeas)"""
    div = FD_LG.get(p['lg'])
    if not div: return None
    k = ('fd', div)
    if k not in cache:
        try: cache[k] = fd_csv(f'/mmz4281/{season_code()[0]}/{div}.csv')
        except Exception: cache[k] = []
    t = dt.datetime.fromisoformat(p['t'].replace('Z', '+00:00')).date()
    sim = lambda a, b: len(norm(a) & norm(b)) / max(1, len(norm(a) | norm(b)))
    cands = []
    for x in cache[k]:
        try: d = fd_date(x['Date'])
        except Exception: continue
        if abs((d - t).days) > 1 or str(x.get('FTHG')) != str(r['hs']) or str(x.get('FTAG')) != str(r['as']) or x.get('HTHG', '') == '': continue
        sc = sim(p['h'], FD_ALIAS.get(x['HomeTeam'], x['HomeTeam'])) + sim(p['a'], FD_ALIAS.get(x['AwayTeam'], x['AwayTeam']))
        cands.append((sc, int(x['HTHG']) + int(x['HTAG'])))
    cands.sort(reverse=True)
    if len(cands) == 1: return cands[0][1]  # misma fecha y mismo marcador final: es ese partido
    if cands and cands[0][0] >= 0.3 and cands[0][0] > cands[1][0]: return cands[0][1]
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
        h = h1_goals(found) if found is not None else fd_h1(p, r, cache)
        if h is None: continue
        r['h1'] = h
        for x in [p['key']] + p['top']:
            if x['fam'] == '1t': x['g'] = g1t(x['k'], h)
        n += 1
    json.dump(P, open(path, 'w'), ensure_ascii=False)
    print(f'primer tiempo: {n} partidos calificados')


# =====================================================================================
def cmd_nba(repo):
    """Suma al récord de la NBA los partidos terminados que aún no se contaron (The Odds API /scores, 2 créditos, cada 3 días)."""
    K = os.environ.get('ODDS_API_KEY', '')
    if not K: print('nba: sin clave'); return
    if TODAY.toordinal() % 3: print('nba: hoy no toca (cada 3 días)'); return
    bd_p = os.path.join(repo, 'tools/build_data.txt'); bd = open(bd_p, encoding='utf-8').read()
    seen_p = os.path.join(repo, 'sys/nba_seen.json'); seen = set(json.load(open(seen_p))) if os.path.exists(seen_p) else None
    import ast
    rec = ast.literal_eval(re.search(r'NBA_REC = (\[.*?\])\n', bd, flags=re.S).group(1))
    f = matcher([r[0] for r in rec])
    G = get(f'https://api.the-odds-api.com/v4/sports/basketball_nba/scores?apiKey={K}&daysFrom=3')
    done = [g for g in G if g.get('completed') and g.get('scores')]
    if seen is None:  # primera vez: solo se marcan como vistos (el récord actual ya los incluye)
        json.dump(sorted(g['id'] for g in done), open(seen_p, 'w')); print(f'nba: inicio, {len(done)} partidos marcados'); return
    R = {r[0]: list(r) for r in rec}; n = 0
    for g in done:
        if g['id'] in seen: continue
        sc = {x['name']: int(float(x['score'])) for x in g['scores']}
        h, a = f(g['home_team']), f(g['away_team'])
        if not h or not a or g['home_team'] not in sc or g['away_team'] not in sc: continue
        win, los = (h, a) if sc[g['home_team']] > sc[g['away_team']] else (a, h)
        R[win][1] += 1; R[los][2] += 1; seen.add(g['id']); n += 1
    bd = re.sub(r'NBA_REC = \[.*?\]\n', 'NBA_REC = ' + repr([tuple(R[r[0]]) for r in rec]) + '\n', bd, count=1, flags=re.S)
    open(bd_p, 'w', encoding='utf-8').write(bd); json.dump(sorted(seen)[-400:], open(seen_p, 'w'))
    print(f'nba: {n} partidos nuevos sumados al récord')

if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'data': sys.exit(0 if cmd_data(sys.argv[2]) else 1)
    if c == 'extra': cmd_extra(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '.')
    if c == 'h1': cmd_h1(sys.argv[2])
    if c == 'nba': cmd_nba(sys.argv[2])
