import pickle,math,collections,json
rows,res=pickle.load(open('calib.pkl','rb'))
RHOS=(-0.2,-0.15,-0.1,-0.05,0.0,0.05)
def ll(p,y):p=min(max(p,1e-6),1-1e-6);return -(math.log(p) if y else math.log(1-p))
def outcomes(r):
    hs,as_=r['hs'],r['as_'];return dict(btts=hs>0 and as_>0,o15=hs+as_>1,o35=hs+as_>3,hs=hs>0,as_=as_>0)
train=lambda r:r['s'] in('2122','2223','2324','2425')
out={}
for lg in sorted({r['lg'] for r in rows}):
    idx=[i for i,r in enumerate(rows) if r['lg']==lg]
    def score(rho,sel):
        tot=0;n=0
        for i in idx:
            if not sel(rows[i]):continue
            o=outcomes(rows[i]);q=res[i][rho]
            for k,y in o.items():tot+=ll(q[k],y);n+=1
        return tot/n
    tr={rho:score(rho,train) for rho in RHOS}; best=min(tr,key=tr.get)
    te={rho:score(rho,lambda r:not train(r)) for rho in RHOS}
    # calibración BTTS con el mejor rho vs -0.1 (test)
    def cal(rho,k):
        sel=[i for i in idx if not train(rows[i])];return round(sum(res[i][rho][k] for i in sel)/len(sel),4),round(sum(outcomes(rows[i])[k] for i in sel)/len(sel),4)
    ht=sum(r['hh']+r['ha'] for r in rows if r['lg']==lg);ft=sum(r['hs']+r['as_'] for r in rows if r['lg']==lg)
    out[lg]=dict(n=len(idx),rho_train=best,ll_test_actual=round(te[-0.1],5),ll_test_mejor=round(te[best],5),mejora_test_pct=round(100*(te[-0.1]-te[best])/te[-0.1],3),
                 btts_test_actual=cal(-0.1,'btts'),btts_test_mejor=cal(best,'btts'),o35_test_actual=cal(-0.1,'o35'),o35_mejor=cal(best,'o35'),
                 ht_share=round(ht/ft,4), ht_share_train=round(sum(r['hh']+r['ha'] for r in rows if r['lg']==lg and train(r))/sum(r['hs']+r['as_'] for r in rows if r['lg']==lg and train(r)),4),
                 ht_share_test=round(sum(r['hh']+r['ha'] for r in rows if r['lg']==lg and not train(r))/max(1,sum(r['hs']+r['as_'] for r in rows if r['lg']==lg and not train(r))),4))
    print(lg,json.dumps(out[lg],ensure_ascii=False))
json.dump(out,open('calib_out.json','w'),ensure_ascii=False,indent=1)
