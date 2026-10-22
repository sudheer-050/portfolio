'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
const {build,validate,stableReleases,previewReleases}=require('./catalog');
const {createPublishing}=require('./publishing');
const clone=x=>JSON.parse(JSON.stringify(x));
const seed=require('./seed/content.json'),templates=path.join(__dirname,'templates');
let checks=0;const check=(name,fn)=>{fn();console.log('PASS',name);checks++;};
const original=build(seed,templates);
check('both site designs display the same complete project inventory',()=>{
  for(const p of seed.projects.filter(p=>p.publication==='published'))for(const site of ['portfolio','hai'])assert(original.files[site+'/projects/index.html'].includes(`data-project="${p.id}"`));
  assert(original.files['portfolio/projects/index.html'].includes('catalog-portfolio'));
  assert(original.files['hai/projects/index.html'].includes('catalog-hai'));
});
check('navigation and guides stay on their own site',()=>{
  for(const [site,domain] of [['portfolio','https://sudheerkumargandiboyana.com'],['hai','https://myhai.org']]){
    assert(original.files[site+'/projects/index.html'].includes(`rel="canonical" href="${domain}/projects/"`));
    assert(original.files[site+'/projects/hagent/index.html'].includes(`href="${domain}/projects/">Explore all projects`));
    assert(original.files[site+'/sitemap.xml'].includes(domain+'/projects/'));
  }
  assert(original.files['portfolio/index.html'].includes('href="/projects/">All projects'));
  assert(original.files['hai/landing.html'].includes('href="/projects/">Playground'));
});
check('a site design change never changes the other site design',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'site-design-'));
  try{
    for(const file of ['portfolio.html','hai.html','resume.html'])fs.copyFileSync(path.join(templates,file),path.join(temporary,file));
    const file=path.join(temporary,'portfolio.html');
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('</head>','<style>.PORTFOLIO_ONLY_THEME_MARKER{color:inherit}</style></head>'));
    const b=build(seed,temporary);
    for(const file of ['index.html','projects/index.html','projects/hagent/index.html'])assert(b.files['portfolio/'+file].includes('PORTFOLIO_ONLY_THEME_MARKER'));
    for(const file of ['landing.html','projects/index.html','projects/hagent/index.html'])assert(!b.files['hai/'+file].includes('PORTFOLIO_ONLY_THEME_MARKER'));
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});

check('portfolio exhibits work and playground provides launch actions',()=>{
  assert(original.files['portfolio/index.html'].includes('href="https://myhai.org/">Playground'));
  assert(original.files['hai/landing.html'].includes('Professional portfolio'));
  assert(original.files['hai/landing.html'].includes("HAI | Sudheer's Playground"));
  for(const p of seed.projects.filter(p=>p.publication==='published')){
    const showcase=original.files['portfolio/projects/'+p.slug+'/index.html'];
    assert(showcase.includes(`href="https://myhai.org/projects/${p.slug}/">Try on myhai.org`));
    assert(showcase.includes('This is the professional showcase.'));
    for(const r of p.releases)for(const asset of r.assets)assert(!showcase.includes(`href="${asset.url}"`));
    if(p.tryUrl){
      const target=p.tryUrl.startsWith('/')?'https://myhai.org'+p.tryUrl:p.tryUrl;
      assert(original.files['hai/projects/index.html'].includes(`href="${target}"`));
      assert(original.files['hai/projects/'+p.slug+'/index.html'].includes(`href="${target}"`));
    }
  }
});

const fixture=clone(seed.projects[0]);Object.assign(fixture,{id:'staging-only-fixture',slug:'staging-only-fixture',name:'Staging fixture',publication:'published',sourceAvailability:'private',sourceUrl:'',aliases:[],featured:true,resume:true});
let c=clone(seed);c.projects.push(clone(fixture));
let rendered=build(c,templates);
check('one new record creates cards and a crawlable guide',()=>{for(const file of ['portfolio/index.html','portfolio/projects/index.html','portfolio/projects/staging-only-fixture/index.html','hai/landing.html','hai/projects/index.html','hai/projects/staging-only-fixture/index.html'])assert(rendered.files[file].includes('Staging fixture'));assert(rendered.files['hai/projects/staging-only-fixture/index.html'].includes('>Staging fixture</h1>'));});
check('shared project edit updates both sites and resume',()=>{c.projects.at(-1).summary='UNIQUE SHARED DESCRIPTION';const b=build(c,templates);for(const f of ['portfolio/index.html','portfolio/resume.html','portfolio/projects/index.html','portfolio/projects/staging-only-fixture/index.html','hai/landing.html','hai/projects/index.html','hai/projects/staging-only-fixture/index.html'])assert(b.files[f].includes('UNIQUE SHARED DESCRIPTION'));});
check('shared profile edits update homepage resume and GitHub',()=>{c.profile.name='Fixture Person';c.contact.email='fixture@example.com';const b=build(c,templates);for(const f of ['portfolio/index.html','portfolio/resume.html','github-profile.md'])assert(b.files[f].includes('Fixture Person'));for(const f of ['portfolio/index.html','portfolio/resume.html'])assert(b.files[f].includes('fixture@example.com'));});
check('archive removes project consistently and makes guide absent',()=>{c.projects.at(-1).publication='archived';const b=build(c,templates);assert(!b.files['hai/projects/staging-only-fixture/index.html']);assert(!b.files['portfolio/projects/staging-only-fixture/index.html']);for(const f of ['portfolio/projects/index.html','hai/projects/index.html','hai/landing.html','portfolio/index.html'])assert(!b.files[f].includes('data-project="staging-only-fixture"'));assert(!JSON.parse(b.files['content.json']).projects.some(p=>p.id===fixture.id));});
check('six stable releases retain only latest five; preview is separate',()=>{const p=clone(fixture);p.releases=Array.from({length:6},(_,i)=>({version:'v'+i,preview:false,date:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`,notes:'Notes '+i,url:'https://example.com/v'+i,assets:[{name:'fixture.zip',url:'https://example.com/'+i+'.zip'}]}));p.releases.push({...p.releases[5],version:'v7-preview',preview:true});assert.equal(stableReleases(p).length,5);assert.equal(stableReleases(p)[0].version,'v5');assert(!stableReleases(p).some(r=>r.version==='v0'));assert.equal(previewReleases(p)[0].version,'v7-preview');const s=clone(seed);s.projects.push(p);const html=build(s,templates).files['hai/projects/staging-only-fixture/index.html'];assert(!html.includes('https://example.com/0.zip'));assert(html.includes('Previews — separate'));assert(html.includes('https://example.com/5.zip'));});
check('private code produces no public source action',()=>{const s=clone(seed);s.projects.push(clone(fixture));const html=build(s,templates).files['hai/projects/staging-only-fixture/index.html'];assert(html.includes('Source is private'));assert(!html.includes('View source'));});
check('URL injection unknown fields duplicate IDs and unsafe sources rejected',()=>{for(const mutate of [s=>s.projects[0].image='javascript:alert(1)',s=>s.secret='not-public',s=>s.projects.push(clone(s.projects[0])),s=>{s.projects[0].sourceAvailability='private';s.projects[0].sourceUrl='https://github.com/private/repo';}]){const s=clone(seed);mutate(s);assert.throws(()=>validate(s));}});
check('unsafe HTML is escaped',()=>{const s=clone(seed);s.projects[0].summary='<script>alert(1)</script>';const b=build(s,templates);assert(b.files['hai/projects/'+s.projects[0].slug+'/index.html'].includes('&lt;script&gt;'));});
check('generated scripts compile and stale disputed claims are absent',()=>{for(const [file,html] of Object.entries(original.files)){if(!file.endsWith('.html'))continue;assert(!/\b293[ -](?:automated|passing|test)|\bGICS\b|MS Business Analytics candidate/.test(html),file);for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('application/ld+json'))new vm.Script(m[1],{filename:file});}});
check('both surfaces expose identical content revision',()=>{for(const f of ['portfolio/index.html','portfolio/resume.html','hai/landing.html','hai/projects/hagent/index.html'])assert(original.files[f].includes(`content="${original.revision}"`));});
if(process.platform!=='win32'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-check-'));
 try{
  const pub=createPublishing(path.join(root,'data'),path.join(root,'public'),templates);pub.init(seed);const first=pub.revision();
  const next=clone(seed);next.hero.badge='STAGING PUBLICATION';next.projects[0].summary='ONE CENTRAL RECORD UPDATED';
  check('draft does not change publication',()=>{pub.saveDraft(next,first);assert.equal(pub.revision(),first);assert.equal(pub.current().hero.badge,seed.hero.badge);});
  let second;
  check('atomic publish and optimistic conflict handling',()=>{second=pub.publish(next,first).revision;assert.notEqual(second,first);assert.throws(()=>pub.publish(seed,first),/changed/);assert.equal(pub.revision(),second);});
  check('rollback restores exact revision and both snapshots',()=>{pub.restore(first,second);assert.equal(pub.revision(),first);assert.equal(pub.current().hero.badge,seed.hero.badge);assert(fs.readFileSync(path.join(root,'public/current/hai/landing.html'),'utf8').includes(first));});
  check('one publication updates saved information in both designs',()=>{
    const result=pub.publish(next,pub.revision());
    const project=next.projects.find(p=>p.publication==='published');
    for(const site of ['portfolio','hai']){
      const html=fs.readFileSync(path.join(root,'public/current',site,'projects',project.slug,'index.html'),'utf8');
      assert(html.includes('ONE CENTRAL RECORD UPDATED'));
      assert(html.includes('catalog-'+site));
    }
    pub.restore(first,result.revision);
  });
  check('published files remain readable independently of CMS',()=>{const html=fs.readFileSync(path.join(root,'public/current/portfolio/index.html'),'utf8');assert(html.includes(seed.profile.name));assert(fs.existsSync(path.join(root,'public/current/hai/projects/hagent/index.html')));});
  check('public snapshot directory is traversable by nginx',()=>{assert.equal(fs.statSync(path.join(root,'public/current')).mode&0o777,0o755);});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}else console.log('Store lifecycle checks require Linux symlink semantics; run in the deployment container.');
console.log(checks+' checks passed');
