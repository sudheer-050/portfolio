#!/usr/bin/env python3
"""Repeatable public catalog, route, metadata, asset and release regression check."""
import concurrent.futures, datetime, json, re, sys, urllib.error, urllib.request
from pathlib import Path

P='https://sudheerkumargandiboyana.com'
H='https://myhai.org'
UA='Mozilla/5.0 (compatible; WebsiteCatalogCheck/1.0)'
results=[]
def request(url,method='GET'):
    req=urllib.request.Request(url,method=method,headers={'User-Agent':UA,'Cache-Control':'no-cache'})
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            body=r.read(3_000_000).decode('utf-8','replace') if method=='GET' else ''
            return r.status,r.url,body
    except urllib.error.HTTPError as exc:return exc.code,exc.url,''
    except Exception as exc:return 0,url,str(exc)
def record(name,passed,detail=''):
    results.append({'check':name,'passed':bool(passed),'detail':detail})
try:
    a=request(P+'/api/content');b=request(H+'/api/catalog/content')
    assert a[0]==200 and b[0]==200, 'Catalog endpoint unavailable'
    portfolio=json.loads(a[2]);hai=json.loads(b[2])
    record('same published revision',portfolio['revision']==hai['revision'],portfolio['revision'])
    projects=portfolio['projects'];ids={p['id'] for p in projects}
    record('same complete inventory',ids=={p['id'] for p in hai['projects']},str(len(ids))+' published projects')
    record('drafts stay private',all(p['publication']=='published' for p in projects))
    pages=[P+'/',P+'/resume.html',P+'/projects/',H+'/',H+'/projects/']+[H+'/projects/'+p['slug']+'/' for p in projects]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        rows=list(pool.map(request,pages))
    for url,(status,final,body) in zip(pages,rows):
        record('page '+url,status==200,str(status))
        record('revision '+url,portfolio['revision'] in body)
        record('metadata '+url,'rel="canonical"' in body and 'name="description"' in body)
        if url.endswith('/projects/'):
            record('inventory '+url,all('data-project="'+p['id']+'"' in body for p in projects))
        record('historical conflicts '+url,not re.search(r'\b293[ -](?:passing|automated|test)|\bGICS\b|MS Business Analytics candidate',body))
    for url in [H+'/project.html?project=missing-regression-check',H+'/projects/missing-regression-check/',P+'/missing-regression-check']:
        record('real 404 '+url,request(url)[0]==404)
    for source,target in [(H+'/jobs.html',H+'/jobs/'),(H+'/project.html?project=hagent',H+'/projects/hagent/'),(P+'/ironman.html',P+'/'),('http://myhai.org/',H+'/'),('http://myhai.org/jobs/',H+'/jobs/'),('http://myhai.org/analyst/',H+'/analyst/'),('https://www.myhai.org/',H+'/')]:
        status,final,_=request(source)
        record('redirect '+source,status==200 and final.rstrip('/')==target.rstrip('/'),str(status)+' '+final)
    for p in projects:
        if p['sourceAvailability']!='public':record('honest source '+p['id'],not p.get('sourceUrl'))
    assets={p['image'] for p in projects if p.get('image')}
    assets.update(u for p in projects for u,_ in p['guide'].get('gallery',[]))
    assets.add(portfolio['profileImage'])
    downloads={a['url'] for p in projects for r in sorted([r for r in p['releases'] if not r['preview']],key=lambda r:r['date'],reverse=True)[:5] for a in r['assets']}
    urls=sorted(assets|downloads)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        responses=list(pool.map(lambda u:request(u,'HEAD'),urls))
    for url,(status,final,_) in zip(urls,responses):record('asset/download '+url,status==200,str(status))
    for url in [P+'/sitemap.xml',H+'/sitemap.xml']:
        status,_,body=request(url);record('sitemap '+url,status==200 and '/projects/' in body)
except Exception as exc:record('monitor execution',False,str(exc))
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':all(r['passed'] for r in results),'checks':len(results),'failures':[r for r in results if not r['passed']],'results':results}
output=Path(sys.argv[1]) if len(sys.argv)>1 else Path('public-verification.json')
output.parent.mkdir(parents=True,exist_ok=True)
temp=output.with_suffix('.tmp');temp.write_text(json.dumps(report,indent=2),encoding='utf-8');temp.replace(output)
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
sys.exit(0 if report['passed'] else 1)
