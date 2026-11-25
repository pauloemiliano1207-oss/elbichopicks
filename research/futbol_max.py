"""Prueba máxima de fútbol: todas las ligas de football-data.co.uk con cuotas de cierre (2012/13 a hoy).
Mismo sistema que 'Partidos de hoy': Pinnacle sin margen (1X2 + total 2.5) -> Poisson/Dixon-Coles -> mercados -> jugada clave y top 3."""
import csv, io, json, math, sys, os, re, collections, urllib.request, datetime as dt
from multiprocessing import Pool
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ns = {}; src = open(os.path.join(R, 'sys/picks_mod.txt')).read(); exec(src[:src.index('def resolve')], ns); grade = ns['grade']
DIVS = {'E0':'Inglaterra 1','E1':'Inglaterra 2','E2':'Inglaterra 3','E3':'Inglaterra 4','EC':'Inglaterra 5','SC0':'Escocia 1','SC1':'Escocia 2','SC2':'Escocia 3','SC3':'Escocia 4',
        'D1':'Alemania 1','D2':'Alemania 2','I1':'Italia 1','I2':'Italia 2','SP1':'España 1','SP2':'España 2','F1':'Francia 1','F2':'Francia 2','N1':'Países Bajos','B1':'Bélgica','P1':'Portugal','T1':'Turquía','G1':'Grecia'}
SEASONS = [f'{y%100:02d}{(y+1)%100:02d}' for y in range(2012, 2027)]
F = [math.factorial(k) for k in range(12)]
def pois(l, k): return math.exp(-l) * l ** k / F[k]
def mat(lh, la, rho=-0.1, G=11):
    ph = [pois(lh, i) for i in range(G)]; pa = [pois(la, j) for j in range(G)]
    M = [[ph[i] * pa[j] for j in range(G)] for i in range(G)]
    M[0][0] *= 1 - lh * la * rho; M[0][1] *= 1 + lh * rho; M[1][0] *= 1 + la * rho; M[1][1] *= 1 - rho
    s = sum(map(sum, M)); return [[x / s for x in r] for r in M]
def P(M, f): return sum(M[i][j] for i in range(len(M)) for j in range(len(M)) if f(i, j))
def fit(pH, pA, pO):
    def err(lh, la):
        M = mat(lh, la); return (P(M, lambda i, j: i > j) - pH) ** 2 + (P(M, lambda i, j: i < j) - pA) ** 2 + (P(M, lambda i, j: i + j > 2.5) - pO) ** 2
    lh, la = 1.4, 1.1; e = err(lh, la)
    for d in (0.32, 0.16, 0.08, 0.04, 0.02, 0.01):
        mv = True
        while mv:
            mv = False
            for dh, da in ((d, 0), (-d, 0), (0, d), (0, -d), (d, d), (-d, -d), (d, -d), (-d, d)):
                if lh + dh < 0.05 or la + da < 0.05: continue
                e2 = err(lh + dh, la + da)
                if e2 < e: e, lh, la, mv = e2, lh + dh, la + da, True
    return lh, la
def mk(fam, k, p): return dict(fam=fam, k=k, p=p)
def num(r, *ks):
    for k in ks:
        v = r.get(k)
        try:
            v = float(v)
            if v > 1: return v
        except Exception: pass
    return None
def load():
    rows = []
    for s in SEASONS:
        for d in DIVS:
            try: txt = urllib.request.urlopen(urllib.request.Request(f'https://www.football-data.co.uk/mmz4281/{s}/{d}.csv', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode('latin-1')
            except Exception: continue
            for r in csv.DictReader(io.StringIO(txt.lstrip('﻿'))):
                try:
                    o = [num(r, 'PSCH', 'PSH', 'AvgCH', 'AvgH', 'BbAvH'), num(r, 'PSCD', 'PSD', 'AvgCD', 'AvgD', 'BbAvD'), num(r, 'PSCA', 'PSA', 'AvgCA', 'AvgA', 'BbAvA')]
                    ov = [num(r, 'PC>2.5', 'AvgC>2.5', 'P>2.5', 'Avg>2.5', 'BbAv>2.5'), num(r, 'PC<2.5', 'AvgC<2.5', 'P<2.5', 'Avg<2.5', 'BbAv<2.5')]
                    if None in o or None in ov or r.get('FTHG', '') == '': continue
                    hh = int(r['HTHG']) if r.get('HTHG', '') not in ('', None) else None; ha = int(r['HTAG']) if r.get('HTAG', '') not in ('', None) else None
                    rows.append(dict(div=d, s=s, h=r['HomeTeam'], a=r['AwayTeam'], hs=int(r['FTHG']), as_=int(r['FTAG']), hh=hh, ha=ha, o=o, ov=ov))
                except Exception: pass
    return rows
nv = lambda xs: [(1 / x) / sum(1 / y for y in xs) for x in xs]
def one(r):
    pH, pD, pA = nv(r['o']); pO = nv(r['ov'])[0]
    lh, la = fit(pH, pA, pO); M = mat(lh, la); G = len(M); f = lambda c: P(M, c); H, A = r['h'], r['a']
    m = [mk('res', 'Gana ' + H, pH), mk('res', 'Empate', pD), mk('res', 'Gana ' + A, pA), mk('dc', H + ' o empate', pH + pD), mk('dc', A + ' o empate', pA + pD), mk('dc', 'Gana cualquiera (no empate)', pH + pA),
         mk('hc', H + ' −1.5', f(lambda i, j: i - j >= 2)), mk('hc', A + ' +1.5', f(lambda i, j: j - i >= -1)), mk('hc', A + ' −1.5', f(lambda i, j: j - i >= 2)), mk('hc', H + ' +1.5', f(lambda i, j: i - j >= -1))]
    for L in (0.5, 1.5, 2.5, 3.5, 4.5):
        po = f(lambda i, j: i + j > L)
        if L < 4.5: m.append(mk('tot', f'Más de {L} goles', po))
        if L > 0.5: m.append(mk('tot', f'Menos de {L} goles', 1 - po))
    m += [mk('btts', 'Ambos anotan: sí', f(lambda i, j: i > 0 and j > 0)), mk('btts', 'Ambos anotan: no', f(lambda i, j: i == 0 or j == 0)), mk('team', H + ' anota', 1 - sum(M[0])), mk('team', H + ' mete 2 o más', f(lambda i, j: i >= 2)),
          mk('team', A + ' anota', 1 - sum(M[i][0] for i in range(G))), mk('team', A + ' mete 2 o más', f(lambda i, j: j >= 2))]
    l1 = (lh + la) * (0.467 if r['div'] == 'D1' else 0.445); p1 = [pois(l1, k) for k in range(12)]
    m += [mk('1t', 'Gol en el 1er tiempo', 1 - p1[0]), mk('1t', 'Más de 1.5 goles en el 1er tiempo', 1 - p1[0] - p1[1]), mk('1t', '1er tiempo sin goles', p1[0])]
    cand = sorted([x for x in m if 0.55 <= x['p'] <= 0.90 and x['fam'] != 'dnb'], key=lambda x: -x['p']); top = []; fams = set()
    for x in cand:
        if x['fam'] in fams: continue
        top.append(x); fams.add(x['fam'])
        if len(top) == 3: break
    fv = max([x for x in m if x['fam'] == 'res'], key=lambda x: x['p']); tight = fv['p'] < 0.62
    alt = [x for x in m if 0.62 <= x['p'] <= 0.85 and x['fam'] in ('tot', 'btts', 'team', 'dc', 'hc', '1t')]
    key = fv if not tight and fv['p'] <= 0.85 else (max(alt, key=lambda x: x['p']) if alt else fv)
    def g(x):
        if x['fam'] == '1t':
            if r['hh'] is None: return None
            t1 = r['hh'] + r['ha']; return {'Gol en el 1er tiempo': t1 > 0, 'Más de 1.5 goles en el 1er tiempo': t1 > 1, '1er tiempo sin goles': t1 == 0}[x['k']] and 'win' or 'loss'
        return grade(x, H, A, r['hs'], r['as_'], 'fut')
    return (r['div'], r['s'], key['p'], g(key), (top[0]['p'], g(top[0])) if top else None)
if __name__ == '__main__':
    rows = load(); print('partidos', len(rows), flush=True)
    with Pool(os.cpu_count() or 2) as pool: out = pool.map(one, rows, chunksize=300)
    def st(xs):
        xs = [x for x in xs if x[1] in ('win', 'loss')]; n = len(xs); w = sum(1 for x in xs if x[1] == 'win')
        return dict(n=n, w=w, acc=round(w / n, 4) if n else None, exp=round(sum(x[0] for x in xs) / n, 4) if n else None)
    R_ = {'partidos': len(out), 'temporadas': f'{SEASONS[0]}-{SEASONS[-1]}', 'ligas': len({o[0] for o in out}),
          'jugada_clave': st([(o[2], o[3]) for o in out]), 'top1': st([o[4] for o in out if o[4]]),
          'por_riesgo': {l: st([(o[2], o[3]) for o in out if lo <= o[2] < hi]) for l, lo, hi in (('bajo (75%+)', .75, 1.01), ('medio (60-75%)', .6, .75), ('alto (<60%)', 0, .6))},
          'por_liga': {DIVS[d]: st([(o[2], o[3]) for o in out if o[0] == d]) for d in DIVS if any(o[0] == d for o in out)},
          'por_temporada': {s: st([(o[2], o[3]) for o in out if o[1] == s]) for s in SEASONS if any(o[1] == s for o in out)}}
    json.dump(R_, open(os.path.join(R, 'research/out/futbol_max.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: R_[k] for k in ('partidos', 'ligas', 'jugada_clave', 'top1', 'por_riesgo')}, ensure_ascii=False))
