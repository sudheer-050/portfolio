'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const bcrypt=require('bcryptjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-http-'));
 const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:'4091',DATA_DIR:path.join(root,'data'),PUBLISH_DIR:path.join(root,'published'),ADMIN_PASSWORD_HASH:bcrypt.hashSync('staging-only-test',4),NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',b=>output+=b);child.stdout.on('data',b=>output+=b);
 const endpoint='http://127.0.0.1:4091/api/';let cookie='';let checks=0;
 async function call(route,body,headers={}){return fetch(endpoint+route,{headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(body?{method:'POST',body:JSON.stringify(body)}:{})});}
 try{
  for(let i=0;i<80;i++){try{const r=await call('content');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  assert.equal((await call('draft')).status,401);checks++;
  assert.equal((await call('login',{password:'wrong'})).status,401);checks++;
  const login=await call('login',{password:'staging-only-test'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];checks++;
  let draft=await (await call('draft')).json();const first=draft.baseRevision;
  draft.content.hero.badge='HTTP STAGING FIXTURE';
  assert.equal((await call('draft',{content:draft.content,expectedRevision:first})).status,200);assert.equal((await (await call('content')).json()).revision,first);checks++;
  const p=await call('content',{content:draft.content,expectedRevision:first});assert.equal(p.status,200);const second=(await p.json()).revision;assert.notEqual(second,first);checks++;
  assert.equal((await call('content',{content:draft.content,expectedRevision:first})).status,409);checks++;
  assert.equal((await call('draft',{content:draft.content,expectedRevision:second},{Origin:'https://evil.example'})).status,403);checks++;
  assert.equal((await call('restore',{revision:'../../etc/passwd',expectedRevision:second})).status,400);checks++;
  assert.equal((await call('restore',{revision:first,expectedRevision:second})).status,200);assert.equal((await (await call('content')).json()).revision,first);checks++;
  assert.equal((await call('publishing-status')).status,200);assert((await (await call('history')).json()).length>=2);checks++;
  console.log(checks+' authenticated HTTP publication checks passed');
 }catch(e){console.error(output);throw e;}finally{child.kill();await new Promise(r=>child.once('exit',r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
