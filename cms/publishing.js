'use strict';
const fs=require('fs');
const path=require('path');
const {build,validate}=require('./catalog');

function atomicJSON(filename,value){
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  const temp=filename+'.'+process.pid+'.tmp';
  const fd=fs.openSync(temp,'w',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,filename);
}
function createPublishing(dataDir,publishDir,templates){
  fs.mkdirSync(publishDir,{recursive:true});
  const history=path.join(dataDir,'revisions'),draftPath=path.join(dataDir,'draft.json');
  fs.mkdirSync(history,{recursive:true});
  const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  const revision=()=>{try{return readJSON(path.join(publishDir,'current/revision.json')).revision;}catch{return null;}};
  const current=()=>readJSON(path.join(history,revision()+'.json')).content;
  function checkExpected(expected){if(expected!==revision()){const e=new Error('The published revision changed. Reload before publishing or restoring.');e.status=409;throw e;}}
  function publish(content,expected,restoredFrom=null){
    checkExpected(expected);validate(content);
    if(expected&&!restoredFrom){
      const old=current();
      for(const p of old.projects)if(!content.projects.some(n=>n.id===p.id))throw new Error('Keep immutable project IDs. Archive '+p.id+' instead of deleting it.');
      for(const p of content.projects){const prior=old.projects.find(x=>x.id===p.id);if(prior&&prior.slug!==p.slug&&!(p.id==='dotflow'&&prior.slug==='dotflow'&&p.slug==='notewll'))throw new Error('Keep published slugs stable: '+p.id);}
    }
    const rendered=build(content,templates),id=rendered.revision;
    if(id===expected)return {revision:id,unchanged:true};
    const directory=path.join(publishDir,id);
    if(!fs.existsSync(directory)){
      const temp=fs.mkdtempSync(path.join(publishDir,'.build-'));
      try{
        // mkdtemp uses 0700; nginx's unprivileged worker must traverse public snapshots.
        fs.chmodSync(temp,0o755);
        for(const [file,body] of Object.entries(rendered.files)){
          const target=path.join(temp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);
        }
        fs.renameSync(temp,directory);
      }catch(e){fs.rmSync(temp,{recursive:true,force:true});throw e;}
    }
    const record={revision:id,publishedAt:new Date().toISOString(),restoredFrom,content};
    if(!fs.existsSync(path.join(history,id+'.json')))atomicJSON(path.join(history,id+'.json'),record);
    // Both readers mount this volume. One atomic pointer switch exposes the whole revision.
    const next=path.join(publishDir,'next-'+process.pid);
    try{fs.unlinkSync(next);}catch(e){if(e.code!=='ENOENT')throw e;}
    fs.symlinkSync(id,next,'dir');fs.renameSync(next,path.join(publishDir,'current'));
    atomicJSON(draftPath,{baseRevision:id,content});
    return {revision:id,projectCount:content.projects.filter(p=>p.publication==='published').length,publishedAt:record.publishedAt};
  }
  return {revision,current,publish,
    init(seed){if(!revision())return publish(seed,null);const content=current();if(build(content,templates).revision!==revision())return publish(content,revision());},
    publicContent:()=>readJSON(path.join(publishDir,'current/content.json')),
    draft:()=>{const saved=fs.existsSync(draftPath)?readJSON(draftPath):null;return saved?.baseRevision===revision()?saved:{baseRevision:revision(),content:current(),recoveredDraft:!!saved};},
    saveDraft(content,expected){checkExpected(expected);validate(content);atomicJSON(draftPath,{baseRevision:expected,content});return {ok:true,revision:expected};},
    history:()=>fs.readdirSync(history).filter(n=>/^[a-f0-9]{16}\.json$/.test(n)).map(n=>{const {content,...meta}=readJSON(path.join(history,n));return meta;}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),
    restore(id,expected){if(!/^[a-f0-9]{16}$/.test(id))throw new Error('Invalid revision');checkExpected(expected);return publish(readJSON(path.join(history,id+'.json')).content,expected,id);}
  };
}
module.exports={createPublishing,atomicJSON};
