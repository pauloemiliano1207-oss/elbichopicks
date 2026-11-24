"""El Bicho Picks · proyecciones de jugadores NFL (yardas, recepciones, touchdowns).
Fuente: nflverse (estadísticas de cada jugador por partido, calendario con línea y total de las casas).
Modelo, para cada jugador y estadística:
  1) promedio por partido de la temporada, pesando más los partidos recientes, mezclado con su temporada anterior;
  2) ajuste por el rival: lo que permite esa defensa a esa posición contra el promedio de la liga;
  3) ajuste por cómo se espera el partido: puntos esperados del equipo (línea y total) contra su promedio;
  4) ajuste local/visitante;
  5) rango y probabilidades con la distribución real de errores medida en temporadas pasadas.
Uso: python3 props.py fit <carpeta_datos>   -> calibra con 2025 y valida con 2026, escribe props_model.json
     python3 props.py build <carpeta_datos> <props_model.json> <salida props.json>"""
import csv, json, sys, os, math, collections, datetime as dt

STATS = {  # clave: (columna(s), posiciones, filtro de participación, tipo)
 'pass_yds': (('passing_yards',), ('QB',), 'qb', 'yds', 'yardas por pase'),
 'pass_td':  (('passing_tds',), ('QB',), 'qb', 'cnt', 'pases de touchdown'),
 'rush_yds': (('rushing_yards',), ('QB', 'RB'), 'rb', 'yds', 'yardas por tierra'),
 'rec_yds':  (('receiving_yards',), ('WR', 'TE', 'RB'), 'rec', 'yds', 'yardas por recepción'),
 'rec':      (('receptions',), ('WR', 'TE', 'RB'), 'rec', 'num', 'recepciones'),
 'any_td':   (('rushing_tds', 'receiving_tds'), ('RB', 'WR', 'TE'), 'any', 'cnt', 'anota touchdown'),
}
DEC = 0.85     # peso de cada partido anterior (el más reciente pesa 1)
K_PRIOR = 2.5  # la temporada pasada vale como 2.5 partidos
K_DEF = 4      # la defensa se acerca al promedio de la liga con 4 partidos virtuales

def fnum(x):
    try: return float(x)
    except: return 0.0

def load(folder, season):
    rows = [r for r in csv.DictReader(open(os.path.join(folder, f'stats_player_week_{season}.csv'))) if r['season_type'] == 'REG']
    for r in rows: r['week'] = int(r['week'])
    return rows

def played(r, kind):
    if kind == 'qb': return fnum(r['attempts']) >= 10
    if kind == 'rb': return fnum(r['carries']) + fnum(r['targets']) >= 3 if r['position'] == 'RB' else fnum(r['attempts']) >= 10
    if kind == 'rec': return fnum(r['targets']) >= 1 or fnum(r['receptions']) > 0
    return fnum(r['carries']) + fnum(r['targets']) >= 2

def val(r, s): return sum(fnum(r[c]) for c in STATS[s][0])

def games_index(folder):
    G = {}
    for g in csv.DictReader(open(os.path.join(folder, 'games.csv'))):
        if g['game_type'] != 'REG': continue
        G[(int(g['season']), int(g['week']), g['home_team'])] = g
        G[(int(g['season']), int(g['week']), g['away_team'])] = g
    return G

def implied(g, team):
    try: sp, tot = float(g['spread_line']), float(g['total_line'])
    except: return None
    return (tot + sp) / 2 if team == g['home_team'] else (tot - sp) / 2

class Season:
    """Todo lo que se sabe antes de la semana w."""
    def __init__(self, rows, prev_rows, G, season):
        self.rows, self.G, self.season = rows, G, season
        self.by_player = collections.defaultdict(list)
        for r in rows: self.by_player[r['player_id']].append(r)
        self.prior = {}
        for s, (cols, pos, kind, *_ ) in STATS.items():
            acc = collections.defaultdict(list)
            for r in prev_rows:
                if r['position'] in pos and played(r, kind): acc[r['player_id']].append(val(r, s))
            self.prior[s] = {p: sum(v) / len(v) for p, v in acc.items() if len(v) >= 3}
        # puntos anotados por equipo y semana
        self.pts = collections.defaultdict(dict)
        for (se, wk, tm), g in G.items():
            if se != season or g['home_score'] in ('', None): continue
            self.pts[tm][wk] = float(g['home_score']) if tm == g['home_team'] else float(g['away_score'])

    def defense(self, s, w):
        if not hasattr(self, '_dc'): self._dc = {}
        if (s, w) not in self._dc: self._dc[(s, w)] = self._defense(s, w)
        return self._dc[(s, w)]

    def _defense(self, s, w):
        """factor por defensa = permitido por partido (suavizado) / promedio de liga, por posición."""
        cols, pos, kind, *_ = STATS[s]
        allowed = collections.defaultdict(lambda: collections.defaultdict(float)); gms = collections.defaultdict(set)
        for r in self.rows:
            if r['week'] >= w or r['position'] not in pos: continue
            allowed[(r['opponent_team'], r['position'])][r['week']] += val(r, s); gms[r['opponent_team']].add(r['week'])
        out = {}
        for p in pos:
            per = {d: sum(v.values()) / max(len(gms[d]), 1) for (d, pp), v in allowed.items() if pp == p}
            if not per: continue
            L = sum(per.values()) / len(per)
            for d, a in per.items():
                n = len(gms[d]); out[(d, p)] = ((a * n + L * K_DEF) / (n + K_DEF)) / L if L > 0 else 1.0
        return out

    def base(self, pid, s, w):
        cols, pos, kind, *_ = STATS[s]
        g = [r for r in self.by_player[pid] if r['week'] < w and played(r, kind)]
        g.sort(key=lambda r: r['week'])
        if not g: return None, 0
        ws = [DEC ** (len(g) - 1 - i) for i in range(len(g))]
        m = sum(wi * val(r, s) for wi, r in zip(ws, g)); W = sum(ws)
        pr = self.prior[s].get(pid)
        if pr is not None: m += pr * K_PRIOR; W += K_PRIOR
        return m / W, len(g)

    def team_avg_pts(self, tm, w):
        v = [p for wk, p in self.pts[tm].items() if wk < w]
        return sum(v) / len(v) if len(v) >= 2 else None

def project(S, P, pid, pos, team, opp, s, w, home, g, D):
    b, n = S.base(pid, s, w)
    if b is None or n < 2: return None
    f = 1.0
    d = D.get((opp, pos))
    if d: f *= d ** P[s]['beta']
    if g is not None:
        imp, avg = implied(g, team), S.team_avg_pts(team, w)
        if imp and avg: f *= (imp / avg) ** P[s]['alpha']
    f *= P[s]['home'] if home else 1 / P[s]['home']
    return b * f

def samples(S, P, ws, stats=None):
    """(estadística, proyección, real) para cada jugador que jugó en las semanas ws, usando solo datos previos."""
    out = []
    for w in ws:
        Ds = {s: S.defense(s, w) for s in (stats or STATS)}
        for r in S.rows:
            if r['week'] != w: continue
            g = S.G.get((S.season, w, r['team']))
            if not g: continue
            for s in (stats or STATS):
                cols, pos, kind, *_ = STATS[s]
                if r['position'] not in pos or not played(r, kind): continue
                mu = project(S, P, r['player_id'], r['position'], r['team'], r['opponent_team'], s, w, r['team'] == g['home_team'], g, Ds[s])
                if mu is not None and mu >= MINMU[s]: out.append((s, mu, val(r, s), r['position']))
    return out

def fit(folder, Y=2026):
    G = games_index(folder)
    S25 = Season(load(folder, Y - 1), load(folder, Y - 2), G, Y - 1)
    S26 = Season(load(folder, Y), load(folder, Y - 1), G, Y)
    W26 = sorted({r['week'] for r in S26.rows}); last = max(W26)
    P = {s: {'alpha': 0.0, 'beta': 0.0, 'home': 1.0} for s in STATS}
    report = {}
    for s in STATS:
        # cuadrícula sobre 2025 (semanas 3-18)
        best = None
        for a in (0, .4, .8, 1.2):
            for b in (0, .5, 1.0):
                for h in (1.0, 1.03):
                    P[s] = {'alpha': a, 'beta': b, 'home': h}
                    sm = samples(S25, P, range(3, 19), [s])
                    mse = sum((mu - y) ** 2 for _, mu, y, _ in sm) / len(sm)
                    if best is None or mse < best[0]: best = (mse, dict(P[s]))
        P[s] = best[1]
        tr = samples(S25, P, range(3, 19), [s])
        # distribución de errores (real / proyección) por estadística
        ratios = sorted(y / mu for _, mu, y, _ in tr)
        q = [ratios[min(len(ratios) - 1, int(i / 100 * len(ratios)))] for i in range(101)]
        P[s]['q'] = [round(x, 4) for x in q]
        # validación fuera de muestra: 2026
        te = samples(S26, P, range(3, last + 1), [s])
        mae = sum(abs(mu - y) for _, mu, y, _ in te) / len(te)
        # comparación con el promedio simple de la temporada
        Pn = {s: {'alpha': 0, 'beta': 0, 'home': 1.0}}
        te0 = samples(S26, Pn, range(3, last + 1), [s])
        mae0 = sum(abs(mu - y) for _, mu, y, _ in te0) / len(te0)
        # calibración: probabilidad de superar líneas a 0.6, 0.8, 1.0, 1.2 de la proyección
        bins = collections.defaultdict(lambda: [0, 0, 0.0])
        for _, mu, y, _ in te:
            for m in (0.6, 0.8, 1.0, 1.2):
                L = line_for(s, mu * m); p = p_over_s(s, P[s]['q'], mu, L)
                k = min(9, int(p * 10)); bins[k][0] += 1; bins[k][1] += (y > L); bins[k][2] += p
        cal = {f'{k*10}-{k*10+10}%': (b[0], round(b[1] / b[0], 3), round(b[2] / b[0], 3)) for k, b in sorted(bins.items()) if b[0] >= 30}
        # "jugada de jugador": línea con 70-80% según el modelo
        hit = [0, 0]
        for _, mu, y, _ in te:
            L = safe_line(s, P[s]['q'], mu)
            if L is not None: hit[0] += 1; hit[1] += (y > L)
        report[s] = {'params': {k: v for k, v in P[s].items() if k != 'q'}, 'n_val': len(te), 'mae': round(mae, 2), 'mae_promedio_simple': round(mae0, 2),
                     'mejora_%': round(100 * (1 - mae / mae0), 1), 'calibracion (n, real, modelo)': cal,
                     'linea_segura': {'n': hit[0], 'acierto': round(hit[1] / max(hit[0], 1), 3)}}
        print(s, json.dumps(report[s], ensure_ascii=False))
    json.dump({'params': P, 'report': report, 'fit': f'{Y-1} (previa {Y-2})', 'val': f'{Y} semanas 3-{last}'}, open('props_model.json', 'w'), ensure_ascii=False)

def line_for(s, x):
    if STATS[s][3] == 'cnt' or s == 'rec': return max(0.5, math.floor(x) + 0.5)
    return max(4.5, round(x / 5) * 5 + 0.5 - 1)  # 204.5, 209.5...

POIS = ('pass_td', 'any_td')
MINMU = {'pass_yds': 120, 'pass_td': 0.5, 'rush_yds': 15, 'rec_yds': 15, 'rec': 1.5, 'any_td': 0.12}
def p_over_s(s, q, mu, L):
    if s in POIS:  # conteos: Poisson
        k = int(math.floor(L)); return max(0.005, min(0.995, 1 - sum(math.exp(-mu) * mu ** i / math.factorial(i) for i in range(k + 1))))
    return p_over(q, mu, L)

def p_over(q, mu, L):
    """P(real > L) con la distribución empírica de real/proyección."""
    r = L / mu
    if r <= q[0]: return 0.995
    if r >= q[-1]: return 0.005
    lo = 0
    while lo < 100 and q[lo + 1] <= r: lo += 1
    frac = (r - q[lo]) / (q[lo + 1] - q[lo]) if q[lo + 1] > q[lo] else 0
    return max(0.005, min(0.995, 1 - (lo + frac) / 100))

def safe_line(s, q, mu, lo=0.70):
    if s == 'any_td': return None
    """La línea más alta que el modelo da con al menos 70% de pasar."""
    best = None
    for k in range(1, 200):
        x = mu * k / 100
        L = line_for(s, x); p = p_over_s(s, q, mu, L)
        if p >= lo: best = (L, p)
    return best[0] if best else None

def build(folder, model_path, out_path):
    M = json.load(open(model_path)); P = M['params']
    G = games_index(folder)
    season = max(int(k[0]) for k in G)
    rows = load(folder, season)
    if not rows: season -= 1; rows = load(folder, season)
    S = Season(rows, load(folder, season - 1), G, season)
    done_w = max(r['week'] for r in rows)
    now = dt.datetime.now(dt.timezone.utc).date()
    # lesionados reportados como fuera
    out_ids = set()
    fi = os.path.join(folder, f'injuries_{season}.csv')
    if os.path.exists(fi):
        inj = list(csv.DictReader(open(fi)))
        wmax = max((int(r['week']) for r in inj), default=0)
        out_ids = {r['gsis_id'] for r in inj if int(r['week']) == wmax and r['report_status'] in ('Out', 'Doubtful')}
    games = []
    for (se, wk, tm), g in G.items():
        if se != season or tm != g['home_team'] or g['home_score'] not in ('', None): continue
        d = dt.date.fromisoformat(g['gameday'])
        if not (now - dt.timedelta(days=1) <= d <= now + dt.timedelta(days=8)): continue
        games.append((wk, g))
    res = []
    for wk, g in sorted(games, key=lambda x: (x[1]['gameday'], x[1]['gametime'])):
        Ds = {s: S.defense(s, wk) for s in STATS}
        item = {'id': g['game_id'], 'wk': wk, 'day': g['gameday'], 'time': g['gametime'], 'h': g['home_team'], 'a': g['away_team'],
                'spread': g['spread_line'], 'total': g['total_line'], 'players': []}
        for team, opp, home in ((g['home_team'], g['away_team'], True), (g['away_team'], g['home_team'], False)):
            recent = [r for r in rows if r['team'] == team and r['week'] >= done_w - 2]
            byp = collections.defaultdict(list)
            for r in recent: byp[r['player_id']].append(r)
            def top(pos, key, n):
                c = [(sum(fnum(x[key]) for x in v), pid, v[-1]) for pid, v in byp.items() if v[-1]['position'] == pos and pid not in out_ids]
                return [x for x in sorted(c, key=lambda x: -x[0])[:n] if x[0] > 0]
            sel = top('QB', 'attempts', 1) + top('RB', 'carries', 2) + top('WR', 'targets', 3) + top('TE', 'targets', 1)
            for _, pid, r in sel:
                pos = r['position']; pl = {'n': r['player_display_name'], 'pos': pos, 'team': team, 'm': []}
                for s, (cols, poss, kind, typ, lab) in STATS.items():
                    if pos not in poss: continue
                    if s == 'rush_yds' and pos == 'QB':
                        b, n = S.base(pid, s, wk + 1)
                        if not b or b < 15: continue
                    mu = project(S, P, pid, pos, team, opp, s, wk, home, g, Ds[s])
                    if mu is None or mu < MINMU[s]: continue
                    q = P[s]['q']
                    if s == 'any_td':
                        p = p_over_s(s, q, mu, 0.5); pl['m'].append({'s': s, 'lab': 'Anota touchdown', 'mu': round(mu, 2), 'p': round(p, 3)}); continue
                    L = safe_line(s, q, mu)
                    lo_, hi_ = mu * q[25], mu * q[75]
                    e = {'s': s, 'lab': lab, 'mu': round(mu, 1), 'r': [round(lo_), round(hi_)]}
                    if L is not None: e['safe'] = {'L': L, 'p': round(p_over_s(s, q, mu, L), 3)}
                    Lm = line_for(s, mu * 0.97); e['mid'] = {'L': Lm, 'p': round(p_over_s(s, q, mu, Lm), 3)}
                    pl['m'].append(e)
                if pl['m']: item['players'].append(pl)
        res.append(item)
    json.dump({'taken': dt.datetime.now(dt.timezone.utc).isoformat()[:19] + 'Z', 'season': season, 'data_week': done_w,
               'src': 'nflverse (estadísticas por partido y líneas de las casas)', 'val': {k: {'n': v['n_val'], 'segura': v['linea_segura']} for k, v in M['report'].items()}, 'vperiod': M['val'],
               'q': {k: v['q'] for k, v in P.items()}, 'pois': list(POIS), 'games': res}, open(out_path, 'w'), ensure_ascii=False)
    print(f'props: {len(res)} partidos, {sum(len(x["players"]) for x in res)} jugadores (datos hasta la semana {done_w})')

if __name__ == '__main__':
    if sys.argv[1] == 'fit': fit(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 2026)
    else: build(sys.argv[2], sys.argv[3], sys.argv[4])
