"""El Bicho Picks · aviso diario por Telegram.
Lee today.json, sys/picks.json y props.json (ya actualizados) y manda un resumen al chat de Telegram.
Variables: TELEGRAM_TOKEN (obligatoria). El chat se detecta solo la primera vez que le escribes /start al bot
y se guarda en sys/telegram_chat.txt (el número de chat no sirve sin el token).
Uso: python3 tools/aviso.py <repo> [--dry]   (--dry solo imprime el mensaje)"""
import json, os, sys, html, urllib.request, urllib.parse, datetime as dt

R = sys.argv[1]; DRY = '--dry' in sys.argv
MX = dt.timezone(dt.timedelta(hours=-6)); NOW = dt.datetime.now(dt.timezone.utc)
DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']; MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
E = lambda s: html.escape(str(s), quote=False)
def t_(iso): return dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
def hm(iso): x = t_(iso).astimezone(MX); return x.strftime('%H:%M')
def pc(p): return f'{round(p * 100)}%'
def load(p, d=None):
    try: return json.load(open(os.path.join(R, p)))
    except Exception: return d

today = load('today.json', {'events': []}); P = load('sys/picks.json', {'picks': []}); PR = load('props.json', {'games': []})
loc = NOW.astimezone(MX); end = (loc + dt.timedelta(days=1)).replace(hour=6, minute=0, second=0)
evs = [e for e in today['events'] if not e.get('pending') and e.get('key') and NOW - dt.timedelta(hours=1) < t_(e['t']) < end]
evs.sort(key=lambda e: e['t'])
L = [f'🐞 <b>El Bicho Picks · {DIAS[loc.weekday()]} {loc.day} {MESES[loc.month - 1]}</b>']

# cómo nos fue ayer
y0 = (loc - dt.timedelta(days=1)).replace(hour=6, minute=0, second=0); y1 = y0 + dt.timedelta(days=1)
yd = [p for p in P['picks'] if p.get('res') and not p['res'].get('void') and y0 <= t_(p['t']).astimezone(MX) < y1 and p['key'].get('g') in ('win', 'loss')]
if yd:
    w = sum(p['key']['g'] == 'win' for p in yd)
    L.append(f'📒 Ayer: <b>{w} de {len(yd)}</b> jugadas clave acertadas ({pc(w / len(yd))})')
wk = [p for p in P['picks'] if p.get('res') and not p['res'].get('void') and t_(p['t']) > NOW - dt.timedelta(days=7) and p['key'].get('g') in ('win', 'loss')]
if len(wk) >= 5:
    w = sum(p['key']['g'] == 'win' for p in wk); L.append(f'🔥 Últimos 7 días: <b>{w} de {len(wk)}</b> ({pc(w / len(wk))})')

if not evs:
    L.append('\nHoy no hay partidos con cuotas en nuestras ligas. 😴')
else:
    SP = [('fut', '⚽ Fútbol'), ('nba', '🏀 NBA'), ('nfl', '🏈 NFL')]
    for sp, name in SP:
        xs = [e for e in evs if e['sp'] == sp]
        if not xs: continue
        L.append(f'\n<b>{name}</b> ({len(xs)})')
        for e in sorted(xs, key=lambda e: -e['key']['p'])[:10]:
            L.append(f"• {hm(e['t'])} {E(e['h'])} vs {E(e['a'])}\n   → <b>{E(e['key']['k'])}</b> · {pc(e['key']['p'])}")
        if len(xs) > 10: L.append(f'   …y {len(xs) - 10} más en la página')
    # parlay seguro: 3 jugadas de 72% a 90%, una por partido, las más probables
    pool = []
    for e in evs:
        c = sorted([x for x in e['m'] if 0.72 <= x['p'] <= 0.90 and x['fam'] != 'dnb'], key=lambda x: -x['p'])
        if c: k = next((x for x in c if x['k'] == e['key']['k']), c[0]); pool.append((e, k))
    pool.sort(key=lambda z: -z[1]['p']); legs = pool[:3]
    if len(legs) == 3:
        pr = 1
        for _, x in legs: pr *= x['p']
        L.append('\n🎯 <b>Parlay seguro del día</b>')
        for e, x in legs: L.append(f"• {E(x['k'])} ({E(e['h'])} vs {E(e['a'])}) · {pc(x['p'])}")
        L.append(f'   Probabilidad: <b>{pc(pr)}</b> · cuota justa {1 / pr:.2f}')
    # NFL: jugadores destacados de los partidos de hoy
    nfl = [e for e in evs if e['sp'] == 'nfl']
    if nfl and PR.get('games'):
        AB = {'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL', 'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI', 'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL', 'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB', 'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX', 'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC', 'Los Angeles Rams': 'LA', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN', 'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG', 'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT', 'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB', 'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS'}
        tags = {(AB.get(e['h']), AB.get(e['a'])) for e in nfl}
        best = []
        for g in PR['games']:
            if (g['h'], g['a']) not in tags: continue
            for pl in g['players']:
                for m in pl['m']:
                    if m['s'] in ('pass_yds', 'rush_yds', 'rec_yds') and m.get('safe') and m['mu'] >= (200 if m['s'] == 'pass_yds' else 55):
                        best.append((m['mu'] if m['s'] != 'pass_yds' else m['mu'] / 3, pl, m))
        best.sort(key=lambda z: -z[0])
        if best:
            L.append('\n🏈 <b>Jugadores destacados</b>')
            for _, pl, m in best[:6]:
                L.append(f"• {E(pl['n'])}: proyecta <b>{round(m['mu'])}</b> {E(m['lab'])} · más de {m['safe']['L']}: {pc(m['safe']['p'])}")
L.append('\n🔗 elbichopicks.pages.dev\n<i>Ninguna jugada es segura. Juega con responsabilidad · +18</i>')
msg = '\n'.join(L)
if len(msg) > 4000: msg = msg[:3990] + '…'
if DRY: print(msg); sys.exit(0)

T = os.environ.get('TELEGRAM_TOKEN', '').strip()
if not T: print('telegram: sin token'); sys.exit(0)
api = lambda m, **q: json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.telegram.org/bot{T}/{m}', data=urllib.parse.urlencode(q).encode() if q else None), timeout=30).read())
cf = os.path.join(R, 'sys/telegram_chat.txt')
chat = os.environ.get('TELEGRAM_CHAT_ID', '').strip() or (open(cf).read().strip() if os.path.exists(cf) else '')
if not chat:
    up = api('getUpdates').get('result', [])
    ids = [u['message']['chat']['id'] for u in up if 'message' in u]
    if not ids: print('telegram: aún nadie le ha escrito /start al bot'); sys.exit(0)
    chat = str(ids[-1]); open(cf, 'w').write(chat); print('telegram: chat detectado y guardado')
r = api('sendMessage', chat_id=chat, text=msg, parse_mode='HTML', disable_web_page_preview='true')
print('telegram: enviado' if r.get('ok') else f'telegram: error {r}')
