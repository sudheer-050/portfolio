#!/usr/bin/env python3
"""Publish only owned catalog sections/metadata, with retryable per-revision status."""
import base64, datetime, fcntl, json, os, re, subprocess, sys
from pathlib import Path

STATUS=Path('/home/bigserver/website-catalog-status/status.json')
BACKUP=Path('/home/bigserver/website-sync-backup-20261022/github')
ALLOWED={'hagent','notewll','bizpack','morningstar','hai-messenger','h-ai','job-portal','tabula-rasa','portfolio'}
BEGIN='<!-- BEGIN SHARED CATALOG -->'
END='<!-- END SHARED CATALOG -->'

def run(args,body=None):
    result=subprocess.run(args,input=body,text=True,capture_output=True,timeout=60)
    if result.returncode: raise RuntimeError(result.stderr.strip()[:600])
    return result.stdout
def gh(endpoint,method='GET',payload=None):
    args=['gh','api',endpoint,'--method',method]
    if payload is not None: args+=['--input','-']
    raw=run(args,json.dumps(payload) if payload is not None else None)
    return json.loads(raw) if raw.strip() else {}
def snapshot(file):
    # Resolve the pointer once, so a concurrent CMS publish cannot mix revisions.
    return run(['docker','exec','portfolio-prod-cms-1','cat',str(Path(SNAPSHOT)/file)])
def backup(repo,file,content):
    target=BACKUP/repo.replace('/','_')/file
    if not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content,encoding='utf-8')
def write_file(repo,file,text,branch=None):
    endpoint=f'repos/{repo}/contents/{file}'
    lookup=endpoint+('?ref='+branch if branch else '')
    try:
        current=gh(lookup)
    except RuntimeError as exc:
        if '404' not in str(exc): raise
        current=None
    old=base64.b64decode(current['content']).decode('utf-8') if current else ''
    if old==text: return False
    backup(repo,file,old)
    payload={'message':f'Synchronize public catalog {REVISION} [skip ci]','content':base64.b64encode(text.encode()).decode()}
    if current:payload['sha']=current['sha']
    if branch:payload['branch']=branch
    gh(endpoint,'PUT',payload)
    return True
def redirect(destination,title):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><link rel="canonical" href="{destination}"><meta http-equiv="refresh" content="0;url={destination}"></head><body><h1>{title}</h1><p><a href="{destination}">Continue to the current page</a></p></body></html>\n'

STATUS.parent.mkdir(parents=True,exist_ok=True)
lock=open(STATUS.parent/'sync.lock','w')
try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:sys.exit(0)
SNAPSHOT=run(['docker','exec','portfolio-prod-cms-1','readlink','-f','/published/current']).strip()
REVISION=json.loads(snapshot('revision.json'))['revision']
status={'revision':REVISION,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':'pending','message':'Synchronization started','destinations':{}}
def save():
    temp=STATUS.with_suffix('.tmp');temp.write_text(json.dumps(status,indent=2),encoding='utf-8');os.chmod(temp,0o644);temp.replace(STATUS)
save()
errors=[]
def task(name,fn):
    try:fn();status['destinations'][name]='synced'
    except Exception as exc:errors.append(name+': '+str(exc));status['destinations'][name]='failed'
    save()
def profile():
    repo='sudheer-050/sudheer-050'
    current=gh(f'repos/{repo}/contents/README.md')
    old=base64.b64decode(current['content']).decode('utf-8')
    generated=snapshot('github-profile.md').strip()
    if BEGIN in old and END in old:
        new=re.sub(re.escape(BEGIN)+r'[\s\S]*?'+re.escape(END),lambda _:generated,old,count=1)
    elif '## I build systems that leave the notebook.' in old and '## Working set' in old:
        # One-time reviewed migration, preserving the banner and handwritten working set.
        start=old.index('## I build systems that leave the notebook.')
        end=old.index('## Working set',start)
        new=old[:start]+generated+'\n\n'+old[end:]
    else:raise RuntimeError('Designated README markers missing; refusing to overwrite handwritten content')
    write_file(repo,'README.md',new)
def metadata():
    for record in json.loads(snapshot('github-metadata.json')):
        repo=record['repository'];owner,name=repo.split('/')
        if owner!='sudheer-050' or name.lower() not in ALLOWED:raise RuntimeError('Repository outside publishing allowlist: '+repo)
        current=gh('repos/'+repo)
        if current['private']:raise RuntimeError('Refusing to publish metadata for private repository '+repo)
        backup(repo,'metadata.json',json.dumps({k:current.get(k) for k in ['description','homepage']},indent=2))
        values={k:record[k] for k in ['description','homepage']}
        if any((current.get(k) or '')!=v for k,v in values.items()):gh('repos/'+repo,'PATCH',values)
def legacy():
    write_file('sudheer-050/sudheer-050.github.io','index.html',redirect('https://sudheerkumargandiboyana.com/resume.html','Current résumé'))
    write_file('sudheer-050/sudheer-050.github.io','hagent/index.html',redirect('https://myhai.org/projects/hagent/','Hagent guide and downloads'))
    write_file('sudheer-050/hagent','docs/index.html',redirect('https://myhai.org/projects/hagent/','Hagent guide and downloads'),'pages/landing')
task('profile',profile)
task('repository_metadata',metadata)
task('legacy_pages',legacy)
status.update(state='failed' if errors else 'synced',message='; '.join(errors) if errors else 'Profile, owned repository metadata and legacy redirects match the published catalog. Unchanged files were skipped.')
status['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();save()
print(json.dumps(status,indent=2))
sys.exit(1 if errors else 0)
