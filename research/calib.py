import csv,io,math,datetime as dt,collections,json,sys
from multiprocessing import Pool
LG={'E0':'Premier League','SP1':'LaLiga','I1':'Serie A','D1':'Bundesliga','F1':'Ligue 1','N1':'Eredivisie','P1':'Liga Portugal'}
rows=[]
for b in open('europa.csv',encoding='utf-8-sig').read().split('### ')[1:]:
    hdr,body=b.split('\n',1);s,d=hdr.split()
    if s not in('2122','2223','2324','2425','2526','2627'):continue
    for r in csv.DictReader(io.StringIO(body)):
        try:
            o=[float(r['PSCH']),float(r['PSCD']),float(r['PSCA'])]
            if not all(x>1 for x in o): o=[float(r['AvgCH']),float(r['AvgCD']),float(r['AvgCA'])]
            try: ov=[float(r['PC>2.5']),float(r['PC<2.5'])]; assert all(x>1 for x in ov)
            except Exception: ov=[float(r['AvgC>2.5']),float(r['AvgC<2.5'])]
            rows.append(dict(lg=LG[d],s=s,hs=int(r['FTHG']),as_=int(r['FTAG']),hh=int(r['HTHG']),ha=int(r['HTAG']),o=o,ov=ov))
        except Exception: pass
nv=lambda xs:[(1/x)/sum(1/y for y in xs) for x in xs]
F=[math.factorial(k) for k in range(12)]
def mat(lh,la,rho,G=11):
    ph=[math.exp(-lh)*lh**i/F[i] for i in range(G)];pa=[math.exp(-la)*la**j/F[j] for j in range(G)]
    M=[[ph[i]*pa[j] for j in range(G)] for i in range(G)]
    M[0][0]*=1-lh*la*rho;M[0][1]*=1+lh*rho;M[1][0]*=1+la*rho;M[1][1]*=1-rho
    s=sum(map(sum,M));return [[x/s for x in r] for r in M]
def stats(M):
    G=len(M);h=a=o=0.0
    for i in range(G):
        for j in range(G):
            v=M[i][j]
            if i>j:h+=v
            elif i<j:a+=v
            if i+j>2.5:o+=v
    return h,a,o
def fit(pH,pA,pO,rho):
    lh,la=1.4,1.1;best=None
    def err(lh,la):
        h,a,o=stats(mat(lh,la,rho));return (h-pH)**2+(a-pA)**2+(o-pO)**2
    e=err(lh,la)
    for d in (0.32,0.16,0.08,0.04,0.02,0.01,0.005):
        moved=True
        while moved:
            moved=False
            for dh,da in((d,0),(-d,0),(0,d),(0,-d),(d,d),(-d,-d),(d,-d),(-d,d)):
                if lh+dh<0.05 or la+da<0.05:continue
                e2=err(lh+dh,la+da)
                if e2<e:e,lh,la,moved=e2,lh+dh,la+da,True
    return lh,la
RHOS=(-0.2,-0.15,-0.1,-0.05,0.0,0.05)
def one(r):
    pH,pD,pA=nv(r['o']);pO=nv(r['ov'])[0];out={}
    for rho in RHOS:
        lh,la=fit(pH,pA,pO,rho);M=mat(lh,la,rho);G=len(M)
        P=lambda f:sum(M[i][j] for i in range(G) for j in range(G) if f(i,j))
        out[rho]=dict(btts=P(lambda i,j:i>0 and j>0),o15=P(lambda i,j:i+j>1.5),o35=P(lambda i,j:i+j>3.5),hs=P(lambda i,j:i>0),as_=P(lambda i,j:j>0),
                      d00=M[0][0],d11=M[1][1],lam=lh+la)
    return out
if __name__=='__main__':
    with Pool(2) as p: res=p.map(one,rows,chunksize=50)
    import pickle;pickle.dump((rows,res),open('calib.pkl','wb'))
    print(len(rows))
