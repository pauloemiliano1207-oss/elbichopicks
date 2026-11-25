"""Calibración NBA con ~21 mil partidos (cuota promedio de ganador + marcador final)."""
import csv, sys, json, math, collections
from statistics import NormalDist
N = NormalDist()
rows = []
for r in csv.DictReader(open(sys.argv[1])):
    try:
        o1, o2 = float(r['odds1']), float(r['odds2']); hs, as_ = int(r['home_team_score']), int(r['away_team_score'])
    except Exception: continue
    if o1 <= 1 or o2 <= 1: continue
    d = r['date']; po = 'Play' in d or 'Pre' in d or 'All' in d
    yr = int(d.split()[2]) if len(d.split()) > 2 and d.split()[2].isdigit() else None
    p = (1 / o1) / (1 / o1 + 1 / o2)
    rows.append(dict(p=p, m=hs - as_, t=hs + as_, yr=yr, po=po, ot=r['overtime'] == 'yes'))
out = {'n': len(rows), 'años': dict(sorted(collections.Counter(x['yr'] for x in rows).items()))}
reg = [x for x in rows if not x['po'] and 0.03 < x['p'] < 0.97]
def fit(xs):
    z = [N.inv_cdf(x['p']) for x in xs]; m = [x['m'] for x in xs]
    b = sum(a * c for a, c in zip(z, m)) / sum(a * a for a in z)
    sd = (sum((c - b * a) ** 2 for a, c in zip(z, m)) / len(xs)) ** .5
    return round(b, 2), round(sd, 2)
out['ajuste_todo'] = fit(reg)
for lo, hi in ((2008, 2014), (2015, 2019), (2020, 2022), (2023, 2026)):
    xs = [x for x in reg if x['yr'] and lo <= x['yr'] <= hi]
    if xs: out[f'ajuste_{lo}-{hi}'] = (len(xs),) + fit(xs)
rec = [x for x in reg if x['yr'] and x['yr'] >= 2021]
# calibración de hándicaps con distintos SD: P(margen del favorito > -x) para líneas típicas
def cal(sd, xs):
    res = {}
    for line in (-12.5, -9.5, -6.5, -3.5, 3.5, 6.5, 9.5, 12.5):
        pr = [];  hit = []
        for x in xs:
            fav_home = x['p'] >= .5; pf = max(x['p'], 1 - x['p']); mu = sd * N.inv_cdf(pf); mf = x['m'] if fav_home else -x['m']
            # apuesta: favorito con hándicap 'line' (negativo: da puntos; positivo: el perro con +line visto desde el favorito)
            if line < 0: q = 1 - N.cdf((-line - mu) / sd); w = mf > -line
            else: q = N.cdf((line - mu) / sd); w = mf < line   # perro +line gana si el favorito gana por menos de line
            pr.append(q); hit.append(w)
        b = collections.defaultdict(lambda: [0, 0, 0.0])
        for q, w in zip(pr, hit):
            k = min(9, int(q * 10)); b[k][0] += 1; b[k][1] += w; b[k][2] += q
        res[str(line)] = {f'{k*10}%': [v[0], round(v[1] / v[0], 3), round(v[2] / v[0], 3)] for k, v in sorted(b.items()) if v[0] >= 40}
    return res
for sd in (12.0, 13.0, 14.0):
    out[f'cal_sd{sd}_2021+'] = cal(sd, rec)
# regla de jugada clave (solo ganador y hándicaps, como en el sitio) con SD elegido
def key_rule(sd, xs, lo=.62, hi=.85, era=False):
    hits = []; exp = []; top1 = []; top1e = []; fav = []; bins = collections.defaultdict(lambda: [0, 0])
    for x in xs:
        if era: sd = 11.6 if (x['yr'] or 0) <= 2014 else 12.2 if (x['yr'] or 0) <= 2019 else 13.3
        fav_home = x['p'] >= .5; pf = max(x['p'], 1 - x['p']); mu = sd * N.inv_cdf(pf); mf = x['m'] if fav_home else -x['m']
        cands = [('fav', pf, mf > 0)]
        for L in (1.5, 3.5, 5.5, 7.5, 9.5, 12.5):
            cands.append((f'fav-{L}', 1 - N.cdf((L - mu) / sd), mf > L)); cands.append((f'dog+{L}', N.cdf((L - mu) / sd), mf < L))
        if lo <= pf <= hi: c = cands[0]
        else:
            ok = [c for c in cands[1:] if lo <= c[1] <= hi]
            if not ok: continue
            c = max(ok, key=lambda c: c[1])
        hits.append(c[2]); exp.append(c[1])
        ok2 = [c for c in cands if .55 <= c[1] <= .90]
        if ok2: t1 = max(ok2, key=lambda c: c[1]); top1.append(t1[2]); top1e.append(t1[1])
        if c[0] == 'fav': fav.append(c[2])
        bk = 'bajo' if c[1] >= .75 else 'medio'; bins[bk][0] += 1; bins[bk][1] += c[2]
    return {'n': len(hits), 'acierto': round(sum(hits) / len(hits), 4), 'esperado': round(sum(exp) / len(exp), 4),
            'top1': [len(top1), round(sum(top1) / len(top1), 4), round(sum(top1e) / len(top1e), 4)],
            'riesgo': {k: [v[0], round(v[1] / v[0], 4)] for k, v in bins.items()}, 'temporadas': '2021-2025'}
for sd in (13.0, 13.3):
    out[f'clave_sd{sd}_2021+'] = key_rule(sd, rec)
# moneyline: calibración de la cuota promedio
b = collections.defaultdict(lambda: [0, 0, 0.0])
for x in rec:
    pf = max(x['p'], 1 - x['p']); w = (x['m'] > 0) == (x['p'] >= .5); k = min(9, int(pf * 10)); b[k][0] += 1; b[k][1] += w; b[k][2] += pf
out['ml_2021+'] = {f'{k*10}%': [v[0], round(v[1] / v[0], 3), round(v[2] / v[0], 3)] for k, v in sorted(b.items())}
out['totales_promedio_por_año'] = {y: round(sum(x['t'] for x in reg if x['yr'] == y) / max(1, sum(1 for x in reg if x['yr'] == y)), 1) for y in sorted({x['yr'] for x in reg if x['yr']})}
out['clave_todo'] = key_rule(13.3, reg, era=True); out['clave_todo']['temporadas'] = f"{min(x['yr'] for x in reg if x['yr'])}-{max(x['yr'] for x in reg if x['yr'])}"
out['clave_todo']['por_año'] = {y: key_rule(13.3, [x for x in reg if x['yr'] == y], era=True)['acierto'] for y in sorted({x['yr'] for x in reg if x['yr']})}
json.dump(out, open('research/out/nba.json', 'w'), ensure_ascii=False, indent=1)
