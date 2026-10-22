'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P = 'https://sudheerkumargandiboyana.com';
const H = 'https://myhai.org';
const published = c => c.projects.filter(p => p.publication === 'published');
const stableReleases = p => (p.releases || []).filter(r => !r.preview).sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
const previewReleases = p => (p.releases || []).filter(r => r.preview).sort((a,b) => b.date.localeCompare(a.date));

function validate(c) {
  const fail = message => { throw new Error(message); };
  const text = (v, label, required=false) => {
    if (typeof v !== 'string' || v.length > 20000 || (required && !v.trim())) fail('Invalid '+label);
  };
  const keys = (o, allowed, label) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) fail('Invalid '+label);
    for (const k of Object.keys(o)) if (!allowed.includes(k)) fail('Unknown field '+label+'.'+k);
  };
  const url = (v,label) => {
    text(v,label); if (!v) return;
    if (/^\/(?!\/)[\w/?#&=.%+~:@-]*$/.test(v)) return;
    try { const u=new URL(v); if (u.protocol==='https:' && !u.username && !u.password) return; } catch {}
    fail('Use an HTTPS URL or an absolute site path for '+label);
  };
  const list = (v,label) => { if (!Array.isArray(v) || v.length>200) fail('Invalid '+label); };
  const strings = (v,label) => { list(v,label); v.forEach(x=>text(x,label)); };
  const pairs = (v,label) => { list(v,label); v.forEach(a=>{if(!Array.isArray(a)||a.length!==2)fail('Invalid '+label);a.forEach(x=>text(x,label));}); };
  keys(c,['schemaVersion','theme','hero','about','projects','certifications','contact','profileImage','profile'],'catalog');
  if(c.schemaVersion!==2)fail('Unsupported schema version');
  if(c.theme!==undefined)text(c.theme,'theme');
  keys(c.hero,['badge','sub'],'hero'); text(c.hero.badge,'hero badge'); text(c.hero.sub,'hero summary');
  keys(c.about,['intro','paragraphs'],'about');text(c.about.intro,'about intro');strings(c.about.paragraphs,'about paragraphs');
  keys(c.contact,['email','phone','linkedin','github','location'],'contact');
  ['email','phone','location'].forEach(k=>text(c.contact[k],k,true));
  if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(c.contact.email))fail('Invalid email');
  ['linkedin','github'].forEach(k=>url(c.contact[k],k));url(c.profileImage,'profile image');strings(c.certifications,'certifications');
  keys(c.profile,['name','headline','summary','graduation','education','experience','skills'],'profile');
  ['name','headline','summary','graduation'].forEach(k=>text(c.profile[k],k,true));
  for(const k of ['education','experience']){
    list(c.profile[k],k);c.profile[k].forEach(x=>{keys(x,['title','date','organization','bullets'],k);['title','date','organization'].forEach(f=>text(x[f],f));strings(x.bullets,'bullets');});
  }
  list(c.profile.skills,'skills'); c.profile.skills.forEach(x=>{keys(x,['category','items'],'skill');text(x.category,'category');text(x.items,'items');});
  list(c.projects,'projects'); const ids=new Set(),slugs=new Set(),aliases=new Set();
  c.projects.forEach(p=>{
    keys(p,['id','slug','name','title','category','image','summary','description','badge','featured','featuredOrder','resume','publication','aliases','tech','why','features','workflow','architecture','trust','status','facts','tryUrl','tryLabel','sourceUrl','sourceAvailability','guide','evidence','releases'],'project');
    if(p.featuredOrder!==undefined&&(!Number.isInteger(p.featuredOrder)||p.featuredOrder<0||p.featuredOrder>999))fail('Invalid featured order');
    for(const k of ['id','slug'])if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p[k]||''))fail('Invalid '+k);
    if(ids.has(p.id)||slugs.has(p.slug))fail('Duplicate project ID or slug');ids.add(p.id);slugs.add(p.slug);
    if(!['published','draft','archived'].includes(p.publication))fail('Invalid publication state');
    if(typeof p.featured!=='boolean'||typeof p.resume!=='boolean')fail('Featured and resume must be booleans');
    if(!['public','private','unavailable'].includes(p.sourceAvailability))fail('Invalid source availability');
    if(p.sourceAvailability!=='public'&&p.sourceUrl)fail('Remove source URL for private/unavailable source');
    for(const k of ['name','category','summary','description','badge','why','architecture','trust','status'])text(p[k],k,['name','summary'].includes(k));
    if(p.title!==undefined&&p.title!==p.name)fail('Project title must match name; use name as the authoritative field');
    for(const k of ['image','tryUrl','sourceUrl'])if(p[k]!==undefined)url(p[k],k);
    if(p.tryLabel!==undefined)text(p.tryLabel,'action label');
    strings(p.aliases,'aliases');p.aliases.forEach(a=>{if(!/^[a-z0-9-]+$/.test(a)||aliases.has(a))fail('Invalid or duplicate alias');aliases.add(a);});
    strings(p.tech,'tech');strings(p.workflow,'workflow');pairs(p.features,'features');pairs(p.facts,'facts');
    keys(p.guide,['uses','requirements','start','faq','gallery'],'guide');
    pairs(p.guide.uses||[],'use cases');strings(p.guide.requirements||[],'requirements');text(p.guide.start||'','getting started');pairs(p.guide.faq||[],'FAQ');
    pairs(p.guide.gallery||[],'gallery');(p.guide.gallery||[]).forEach(x=>url(x[0],'gallery image'));
    list(p.evidence,'evidence');p.evidence.forEach(x=>{keys(x,['claim','url','version','reviewed','scope'],'evidence');for(const k of ['claim','version','reviewed','scope'])text(x[k],k,true);url(x.url,'evidence URL');if(!x.url)fail('Evidence needs a supporting URL');});
    list(p.releases,'releases');const versions=new Set();p.releases.forEach(r=>{
      keys(r,['version','preview','date','notes','url','assets'],'release');text(r.version,'version',true);if(versions.has(r.version))fail('Duplicate release version');versions.add(r.version);
      if(typeof r.preview!=='boolean'||!/^\d{4}-\d\d-\d\dT/.test(r.date)||!Number.isFinite(Date.parse(r.date)))fail('Invalid release date/channel');
      text(r.notes,'release notes');url(r.url,'release URL');list(r.assets,'release assets');r.assets.forEach(a=>{keys(a,['name','url'],'asset');text(a.name,'asset name',true);url(a.url,'download URL');});
    });
  });
  for(const a of aliases)if(ids.has(a)||slugs.has(a))fail('Alias collides with project ID/slug');
  return c;
}

const guideUrl = p => H+'/projects/'+p.slug+'/';
function actions(p) {
  return (p.tryUrl?`<a class="button primary" href="${esc(p.tryUrl.startsWith('/')?H+p.tryUrl:p.tryUrl)}">${esc(p.tryLabel||'Open app')} ↗</a>`:'')+
    (p.sourceAvailability==='public'&&p.sourceUrl?`<a class="button" href="${esc(p.sourceUrl)}">View source ↗</a>`:`<span class="availability">${p.sourceAvailability==='private'?'Source is private':'No public source listed'}</span>`);
}
const sharedStyle=`<style>html{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0c10;color:#eef0f4;font:16px/1.65 system-ui,sans-serif}a{color:#c0b4ff;text-underline-offset:4px}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #d3c6ff;outline-offset:5px}header,main,footer{max-width:1140px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}nav{display:flex;gap:20px;flex-wrap:wrap}.eyebrow,.availability{color:#b1b7c6;font-size:.86rem}h1{font-size:clamp(2.4rem,7vw,5rem);line-height:1.05;letter-spacing:-.04em}h2{line-height:1.2}p,li{overflow-wrap:anywhere}img{max-width:100%;height:auto;border-radius:12px}.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:36px;align-items:center;margin:35px 0 60px}.summary{font-size:1.18rem;color:#c4c9d4}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}.card,section.detail{border:1px solid #30343e;padding:26px;border-radius:16px;background:#11141b;margin-bottom:24px}.card img{aspect-ratio:16/9;object-fit:contain;background:#080a0e}.card h2{font-size:1.4rem}.button{display:inline-block;border:1px solid #6b607f;padding:10px 16px;border-radius:8px;text-decoration:none;margin:5px 8px 5px 0}.primary{background:#cabaff;color:#14101d}.pill{display:inline-block;border:1px solid #414652;border-radius:30px;padding:2px 10px;margin:4px;font-size:.8rem}dt{font-weight:700}dd{margin:0 0 14px;color:#c4c9d4}details{border-top:1px solid #343944;padding:16px 0}summary{cursor:pointer;font-weight:600}.release{border-bottom:1px solid #343944;padding:18px 0;white-space:pre-wrap}.skip{position:absolute;left:-9999px}.skip:focus{left:20px;background:#111;padding:12px;z-index:20}@media(max-width:700px){.hero{grid-template-columns:1fr}header,main,footer{padding:20px}h1{margin:20px 0}nav{gap:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}@media print{header,footer,.button{display:none}body{background:white;color:black}.card,section.detail{background:white;color:black;border-color:#aaa}}</style>`;
function page(title,summary,url,body,c,revision,image=P+'/profile.png') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(summary)}"><link rel="canonical" href="${esc(url)}"><meta name="content-revision" content="${revision}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(summary)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">${sharedStyle}</head><body><a class="skip" href="#main">Skip to content</a><header><a href="${url.startsWith(P)?P:H}/">${esc(url.startsWith(P)?c.profile.name:'HAI')}</a><nav aria-label="Main navigation"><a href="${P}/projects/">All projects</a><a href="${P}/resume.html">Résumé</a><a href="${H}/#apps">Apps</a><a href="mailto:${esc(c.contact.email)}">Contact</a></nav></header><main id="main">${body}</main><footer>© 2026 ${esc(c.profile.name)} · <a href="${P}/">Portfolio</a> · <a href="${H}/">HAI</a></footer></body></html>`;
}
const list = values => `<ul>${values.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
const pairList = values => `<dl>${values.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
const pills = p => p.tech.map(t=>`<span class="pill">${esc(t)}</span>`).join('');
function projectPage(p,c,revision) {
  const g=p.guide;
  const releases=(items,label)=>items.length?`<section class="detail"><h2>${label}</h2>${items.map(r=>`<article class="release"><h3><a href="${esc(r.url)}">${esc(r.version)}</a>${r.preview?' · Preview':''}</h3><p>${esc(r.date.slice(0,10))}</p><p>${esc(r.notes)}</p>${r.assets.length?r.assets.map(a=>`<a class="button" href="${esc(a.url)}">Download ${esc(a.name)}</a>`).join(''):'<p>No installer assets listed for this release. Check release notes for source archives and setup.</p>'}</article>`).join('')}</section>`:'';
  const body=`<div class="hero"><div><p class="eyebrow">${esc(p.category)}</p><h1>${esc(p.name)}</h1><p class="summary">${esc(p.summary)}</p><div>${pills(p)}</div><div>${actions(p)}</div></div>${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)} project preview" width="960" height="540">`:''}</div>
    <section class="detail"><h2>What it is for</h2><p>${esc(p.description)}</p><p>${esc(p.why)}</p>${pairList(g.uses||[])}</section>
    <section class="detail"><h2>Get started</h2><p>${esc(g.start||'Read the linked project documentation.')}</p>${list(g.requirements||[])}${actions(p)}</section>
    <section class="detail"><h2>Features and workflow</h2>${pairList(p.features)}<ol>${p.workflow.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>
    <section class="detail"><h2>Architecture</h2><p>${esc(p.architecture)}</p><h2>Privacy and limitations</h2><p>${esc(p.trust)}</p><h2>Status</h2><p>${esc(p.status)}</p>${pairList(p.facts)}</section>
    ${(p.evidence||[]).length?`<section class="detail"><h2>Evidence</h2>${p.evidence.map(x=>`<p><a href="${esc(x.url)}">${esc(x.claim)}</a><br>${esc(x.version)} · reviewed ${esc(x.reviewed)}<br>${esc(x.scope)}</p>`).join('')}</section>`:''}
    ${releases(stableReleases(p),'Latest stable releases')}${releases(previewReleases(p),'Previews — separate from stable releases')}
    ${(g.gallery||[]).length?`<section class="detail"><h2>Gallery</h2><div class="grid">${g.gallery.map(([url,caption])=>`<figure><a href="${esc(url)}"><img src="${esc(url)}" alt="${esc(caption)}" loading="lazy"></a><figcaption>${esc(caption)}</figcaption></figure>`).join('')}</div></section>`:''}
    <section class="detail"><h2>Questions</h2>${(g.faq||[]).map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section><p><a href="${H}/projects/">Explore all projects →</a></p>`;
  const schema={'@context':'https://schema.org','@type':'SoftwareApplication',name:p.name,description:p.summary,url:guideUrl(p),applicationCategory:p.category,image:p.image||undefined};
  return page(p.name+' | HAI Projects',p.summary,guideUrl(p),body,c,revision,p.image||undefined).replace('</head>',`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head>`);
}
function directory(c,revision,domain) {
  return page('Projects | '+c.profile.name,'All published applications, research and coursework.',domain+'/projects/',`<p class="eyebrow">Projects and research</p><h1>All the work.<br>One place to explore.</h1><p class="summary">Live apps, open source, research and coursework. Each guide explains availability, setup and limitations.</p><div class="grid">${published(c).map(p=>`<article class="card" data-project="${p.id}">${p.image?`<a href="${guideUrl(p)}"><img src="${esc(p.image)}" alt="${esc(p.name)} preview" loading="lazy" width="800" height="450"></a>`:''}<p class="eyebrow">${esc(p.badge)}</p><h2><a href="${guideUrl(p)}">${esc(p.name)}</a></h2><p>${esc(p.summary)}</p><p>${esc(p.status)}</p><a class="button" href="${guideUrl(p)}">Explore project →</a></article>`).join('')}</div>`,c,revision);
}

// Replace a complete element without parsing or rewriting the site's scripts/styles.
function replaceElement(source, tag, attribute, value, replacement) {
  const start=new RegExp('<'+tag+'\\b[^>]*\\b'+attribute+(attribute==='hidden'?'(?:\\s|>)':'="'+value+'"[^>]*>'),'i').exec(source);
  if(!start) throw new Error('Template slot missing: '+attribute+'='+value);
  const tags=new RegExp('</?'+tag+'\\b[^>]*>','gi'); tags.lastIndex=start.index;let depth=0,m;
  while((m=tags.exec(source))){depth+=m[0].startsWith('</')?-1:1;if(depth===0)return source.slice(0,start.index)+replacement+source.slice(tags.lastIndex);}
  throw new Error('Unclosed template slot '+value);
}
function bindings(source,c) {
  const read=p=>p.split('.').reduce((v,k)=>v?.[k],c);
  source=source.replace(/(<([a-z0-9]+)\b[^>]*\bdata-content="([^"]+)"[^>]*>)[\s\S]*?<\/\2>/gi,(whole,open,tag,key)=>typeof read(key)==='string'?open+esc(read(key))+'</'+tag+'>':whole);
  source=source.replace(/<[^>]+\bdata-content-href="([^"]+)"[^>]*>/g,(whole,key)=>{
    const value=read(key);if(typeof value!=='string')return whole;
    return whole.replace(/href="[^"]*"/,`href="${esc(key==='contact.email'?'mailto:'+value:value)}"`);
  });
  source=source.replace(/(<img\b[^>]*id="portrait"[^>]*>)/g,whole=>whole.replace(/src="[^"]*"/,`src="${esc(c.profileImage)}"`));
  return source;
}
function profileMetadata(source,c,kind){
  const title=c.profile.name+' | '+c.profile.headline+(kind==='resume'?' Résumé':'');
  source=source.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)}</title>`);
  source=source.replace(/(<meta\b[^>]*(?:name|property)="(?:description|og:description|twitter:description)"[^>]*content=")[^"]*("[^>]*>)/g,(_,a,b)=>a+esc(c.profile.summary)+b);
  source=source.replace(/(<meta\b[^>]*(?:name|property)="(?:og:title|twitter:title)"[^>]*content=")[^"]*("[^>]*>)/g,(_,a,b)=>a+esc(title)+b);
  const person={'@context':'https://schema.org','@type':'Person',name:c.profile.name,jobTitle:c.profile.headline,email:'mailto:'+c.contact.email,url:P+'/',sameAs:[c.contact.github,c.contact.linkedin],image:c.profileImage};
  return source.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,`<script type="application/ld+json">${JSON.stringify(person).replace(/</g,'\\u003c')}</script>`);
}
function portfolio(c,revision,templates) {
  let source=fs.readFileSync(path.join(templates,'portfolio.html'),'utf8');
  // Facts are generated at publication, including the no-JavaScript experience.
  source=source.replace(/fetch\('api\/content',[\s\S]*?\.catch\([\s\S]*?\}\);/,'');
  const featured=published(c).filter(p=>p.featured).sort((a,b)=>(a.featuredOrder??999)-(b.featuredOrder??999));
  const cards=featured.map((p,i)=>`<article class="project${i===0?' featured-project':''}" id="project-${p.id}" data-project="${p.id}"><div class="project-visual">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)} preview" loading="lazy" width="800" height="450">`:''}</div><div class="project-body"><div class="project-kicker"><span>${esc(p.category)}</span><span class="badge">${esc(p.badge)}</span></div><h3>${esc(p.name)}</h3><p class="project-summary">${esc(p.summary)}</p><p class="stack">${esc(p.tech.join(' / '))}</p><details><summary>Engineering details</summary><p>${esc(p.architecture)}</p><p>${esc(p.status)}</p></details><div class="project-links"><a href="${guideUrl(p)}">Explore project ↗</a>${p.sourceAvailability==='public'&&p.sourceUrl?`<a href="${esc(p.sourceUrl)}">GitHub ↗</a>`:''}</div></div></article>`);
  source=replaceElement(source,'section','id','projects',`<section class="section wrap" id="projects"><div class="section-head"><div><p class="eyebrow">01 / Selected work</p><h2>Ideas into working systems.</h2></div><p><a class="button" href="/projects/">Browse all ${published(c).length} projects →</a></p></div>${cards[0]||''}<div class="work-grid">${cards.slice(1).join('')}</div></section>`);
  source=source.replace('<a href="#projects">Selected work</a>','<a href="#projects">Selected work</a><a href="/projects/">All projects</a>');
  source=replaceElement(source,'div','class','proof',`<div class="proof" aria-label="Selected projects">${featured.slice(0,3).map(p=>`<a href="#project-${p.id}"><span class="proof-label">${esc(p.category)}</span><strong>${esc(p.name)}</strong><p>${esc(p.badge)} ↗</p></a>`).join('')}</div>`);
  source=replaceElement(source,'div','class','about-copy',`<div class="about-copy"><p>${esc(c.about.intro)}</p>${c.about.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="skill-grid">${c.profile.skills.map(x=>`<div class="skill"><h3>${esc(x.category)}</h3><p>${esc(x.items)}</p></div>`).join('')}</div></div>`);
  source=replaceElement(source,'div','class','education',`<div class="education" id="education">${c.profile.education.map(x=>`<div><p class="eyebrow">Education</p><h3>${esc(x.title)}</h3><p>${esc(x.organization)}</p><p>${esc(x.date)}</p></div>`).join('')}<div><p class="eyebrow">Continued learning</p>${list(c.certifications)}</div></div>`);
  const experience=`<div class="experience-grid"><div><p class="eyebrow">03 / Experience</p><h2>Engineering experience.<br>Business context.</h2><a class="resume-link" href="resume.html">Full experience &amp; achievements ↗</a></div><div>${c.profile.experience.map(x=>`<article class="job"><p class="job-date">${esc(x.date)}</p><div><h3>${esc(x.title)}</h3><p class="job-org">${esc(x.organization)}</p>${list(x.bullets)}</div></article>`).join('')}</div></div>`;
  source=replaceElement(source,'div','class','experience-grid',experience);
  source=source.replace(/<p class="role-line">[\s\S]*?<\/p>/,`<p class="role-line">${esc(c.profile.headline)} <span aria-hidden="true">/</span> ${esc(c.contact.location)}</p>`);
  source=source.replace(/<h1 id="intro-title">[\s\S]*?<\/h1>/,`<h1 id="intro-title">${esc(c.profile.name)}</h1>`);
  source=source.replace(/<strong>Sudheer Kumar Gandiboyana<\/strong><p>DePaul MSBA · Chicago, IL<\/p>/,`<strong>${esc(c.profile.name)}</strong><p>${esc(c.profile.headline)} · ${esc(c.contact.location)}</p>`);
  source=bindings(source,c);
  source=profileMetadata(source,c,'home');
  return source.replace('</head>',`<meta name="content-revision" content="${revision}"></head>`);
}
function hai(c,revision,templates) {
  let source=fs.readFileSync(path.join(templates,'hai.html'),'utf8');
  source=replaceElement(source,'div','hidden','', '');
  source=replaceElement(source,'div','class','contact-list reveal',`<div class="contact-list reveal"><a class="contact-link" href="mailto:${esc(c.contact.email)}"><span>Email</span><strong>${esc(c.contact.email)}</strong></a><a class="contact-link" href="${esc(c.contact.linkedin)}"><span>LinkedIn</span><strong>${esc(c.profile.name)}</strong></a><a class="contact-link" href="${esc(c.contact.github)}"><span>GitHub</span><strong>Source and experiments</strong></a><div class="contact-link location"><span>Location</span><strong>${esc(c.contact.location)}</strong></div><a class="contact-link" href="${P}/admin"><span>Publishing</span><strong>Content studio ↗</strong></a></div>`);
  const ps=published(c);
  source=replaceElement(source,'div','class','systems-rail',`<div class="systems-rail">${ps.map((p,i)=>`<a class="system-card" href="/projects/${p.slug}/"><span class="system-index">${String(i+1).padStart(2,'0')}</span><div class="system-copy"><span class="system-type">${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p><span class="system-link">View full information</span></div><div class="system-media">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)} preview" loading="lazy">`:''}</div></a>`).join('')}</div>`);
  source=replaceElement(source,'div','class','project-grid',`<div class="project-grid">${ps.map(p=>`<div class="project-card" data-project="${p.id}">${p.image?`<img class="project-media" src="${esc(p.image)}" alt="${esc(p.name)} preview" loading="lazy">`:''}<h3>${esc(p.name)}</h3><p class="project-desc">${esc(p.summary)}</p><div class="project-tech">${pills(p)}</div><div class="project-actions"><a class="project-btn primary" href="/projects/${p.slug}/">View details</a></div></div>`).join('')}</div>`);
  // Old panel entry points remain usable; their facts come from the same records.
  for(const [panel,id] of [['hai','hai'],['h','h'],['app-three','analyst'],['app-four','jobs']]){
    const p=ps.find(p=>p.id===id);
    source=replaceElement(source,'div','id','panel-'+panel,`<div class="app-panel" id="panel-${panel}"><button type="button" class="panel-back-btn" onclick="showPanel('home')">← All apps</button>${p?`<h1>${esc(p.name)}</h1><p class="subtitle">${esc(p.summary)}</p><p>${esc(p.status)}</p><a class="btn-primary" href="/projects/${p.slug}/">Read full guide →</a>`:'<h1>Project archived</h1><a href="/projects/">Browse current projects</a>'}</div>`);
  }
  // These five older summary cards duplicated independent project descriptions.
  source=source.replace(/<div class="app-summary-card" onclick="window\.location\.href='\/project\.html\?project=([^']+)'">[\s\S]*?<\/div>/g,(whole,id)=>{
    const p=ps.find(p=>p.id===id);return p?`<a class="app-summary-card" href="/projects/${p.slug}/"><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p></a>`:'';
  });
  source=source.replace(/\/project\.html\?project=([a-z0-9-]+)/g,(all,id)=>'/projects/'+(ps.find(p=>p.id===id)?.slug||id)+'/');
  source=source.replace('</head>',`<meta name="content-revision" content="${revision}"><style>.app-summary-card{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid #9ef4ff;outline-offset:5px}.system-copy p{overflow-wrap:anywhere}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}.skip-link{position:absolute;left:-10000px}.skip-link:focus{left:20px;top:20px;z-index:9999;background:#111;padding:14px}</style></head>`);
  source=source.replace('<body>','<body><a class="skip-link" href="#apps">Skip to apps</a>');
  source=source.replace("const mobileNav = document.getElementById('mobileNav');",`const mobileNav = document.getElementById('mobileNav');
        document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobileNav.classList.contains('open')){mobileNav.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');menuBtn.focus();}});`);
  return source.replace('</head>','<style>.systems-rail .system-type{color:#b1bac8}.systems-rail .system-copy h3{overflow-wrap:anywhere}@media(max-width:900px){.systems-rail .system-card{grid-template-columns:minmax(0,1fr);gap:18px}.systems-rail .system-copy,.systems-rail .system-media{min-width:0;max-width:100%;width:auto}.systems-rail .system-copy p{max-width:100%}}</style></head>');
}
function resume(c,revision,templates) {
  let source=fs.readFileSync(path.join(templates,'resume.html'),'utf8');
  const entry=x=>`<div class="entry"><div class="entry-head"><span class="entry-title">${esc(x.title)}</span><span class="entry-date">${esc(x.date)}</span></div><div class="entry-org">${esc(x.organization)}</div>${x.bullets.length?list(x.bullets):''}</div>`;
  const section=(title,body)=>{source=source.replace(new RegExp('<section>\\s*<h2>'+title+'</h2>[\\s\\S]*?</section>'),`<section><h2>${title}</h2>${body}</section>`);};
  source=source.replace(/<h1>.*?<\/h1>/,`<h1>${esc(c.profile.name)}</h1>`).replace(/<div class="role">.*?<\/div>/,`<div class="role">${esc(c.profile.headline)}</div>`);
  source=source.replace(/<p class="summary">[\s\S]*?<\/p>/,`<p class="summary">${esc(c.profile.summary)}</p>`);
  source=replaceElement(source,'div','class','contact',`<div class="contact"><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a><a href="tel:${esc(c.contact.phone.replace(/[^+\d]/g,''))}">${esc(c.contact.phone)}</a><a href="${esc(c.contact.linkedin)}">LinkedIn</a><a href="${esc(c.contact.github)}">GitHub</a><a href="${P}">Portfolio</a><span>${esc(c.contact.location)}</span></div>`);
  section('Experience',c.profile.experience.map(entry).join(''));
  section('Projects',published(c).filter(p=>p.resume).map(p=>`<div class="entry"><div class="entry-head"><a class="entry-title" href="${guideUrl(p)}">${esc(p.name)}</a><span class="entry-date">${esc(p.badge)}</span></div>${list([p.summary])}<div class="entry-tags">${esc(p.tech.join(' · '))}</div></div>`).join(''));
  section('Education',c.profile.education.map(entry).join(''));
  section('Skills',`<div class="skills-grid">${c.profile.skills.map(x=>`<div class="skill-row"><b>${esc(x.category)}</b> ${esc(x.items)}</div>`).join('')}</div>`);
  section('Certifications',`<div class="certs">${esc(c.certifications.join(' · '))}</div>`);
  return profileMetadata(source,c,'resume').replace('</head>',`<meta name="content-revision" content="${revision}"></head>`);
}
function build(c,templates) {
  validate(c);
  const revision=crypto.createHash('sha256').update(JSON.stringify(c)).update(fs.readFileSync(__filename)).update(['portfolio.html','hai.html','resume.html'].map(f=>fs.readFileSync(path.join(templates,f),'utf8')).join('\n')).digest('hex').slice(0,16);
  const publicContent=JSON.parse(JSON.stringify(c));publicContent.projects=published(publicContent);publicContent.revision=revision;
  const result={
    'portfolio/index.html':portfolio(c,revision,templates),
    'portfolio/resume.html':resume(c,revision,templates),
    'portfolio/projects/index.html':directory(c,revision,P),
    'hai/landing.html':hai(c,revision,templates),
    'hai/projects/index.html':directory(c,revision,H),
    'content.json':JSON.stringify(publicContent,null,2),
    'revision.json':JSON.stringify({revision,projectCount:published(c).length}),
    'github-profile.md':`<!-- BEGIN SHARED CATALOG -->\n## ${c.profile.name} · ${c.profile.headline}\n\n${c.profile.summary}\n\n${published(c).map(p=>`- [${p.name}](${guideUrl(p)}) — ${p.summary}`).join('\n')}\n\n[Portfolio](${P}/) · [Résumé](${P}/resume.html) · [Apps](${H}/)\n<!-- END SHARED CATALOG -->\n`,
    'github-metadata.json':JSON.stringify(published(c).filter(p=>p.sourceAvailability==='public'&&p.sourceUrl?.startsWith('https://github.com/sudheer-050/')).map(p=>({repository:p.sourceUrl.split('/').slice(3,5).join('/'),description:p.summary.slice(0,350),homepage:guideUrl(p)})),null,2)
  };
  for(const p of published(c))result['hai/projects/'+p.slug+'/index.html']=projectPage(p,c,revision);
  for(const [domain,folder,urls] of [[P,'portfolio',['/','/resume.html','/projects/']],[H,'hai',['/','/projects/',...published(c).map(p=>'/projects/'+p.slug+'/')]]]){
    result[folder+'/sitemap.xml']='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${domain}${u}</loc></url>`).join('')+'</urlset>';
    result[folder+'/robots.txt']=`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /api/\nSitemap: ${domain}/sitemap.xml\n`;
  }
  return {revision,files:result};
}
module.exports={validate,build,published,stableReleases,previewReleases,replaceElement};
