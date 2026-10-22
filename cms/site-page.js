'use strict';
// Catalog facts use each site's existing fonts, CSS, header and footer.
module.exports=function sitePage(source,generated,body,domain,isPortfolio){
  const head=generated.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<style>[\s\S]*?<\/style>/g,'');
  const nativeHead=source.match(/<head[^>]*>([\s\S]*?)<\/head>/)[1];
  const fallback=(nativeHead.match(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/g)||[]).join('\n');
  const native=nativeHead.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/g,'');
  const styles=[...native.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>|<link\b[^>]*>/g)].map(m=>m[0]).filter(tag=>tag.startsWith('<style')||/rel="(?:stylesheet|preconnect|icon)"/.test(tag)).join('\n');
  const links=html=>html.replace(/\s+onclick="[^"]*"/g,'').replace(/href="#(?:home)?"/g,'href="/"').replace(/href="#([^"]+)"/g,'href="/#$1"').replace(/href="resume.html"/g,'href="/resume.html"').replace(/href="https:\/\/(?:myhai.org|sudheerkumargandiboyana.com)\/projects\/"/g,`href="${domain}/projects/"`).replace(/ class="active"/g,'');
  const header=links(source.match(/<header\b[\s\S]*?<\/header>/)[0]),footer=links(source.match(/<footer\b[\s\S]*?<\/footer>/)[0]);
  const css=`<style>
    .skip-link{position:absolute;left:-10000px}.skip-link:focus{left:20px;top:20px;z-index:9999;background:#111;color:#fff;padding:14px}
    .catalog-main{max-width:1200px;margin:auto;padding:60px 28px 90px;min-height:70vh;overflow-wrap:anywhere}
    .catalog-main .catalog-title{font-size:clamp(2.8rem,6vw,5.5rem);line-height:1.05;margin:20px 0 28px}
    .catalog-main .catalog-summary{font-size:1.12rem;line-height:1.7;max-width:760px;margin:22px 0 35px;color:inherit;opacity:.8}
    .catalog-main .catalog-hero{display:grid;grid-template-columns:1.2fr 1fr;gap:36px;align-items:center;margin-bottom:48px}
    .catalog-main .catalog-hero img{width:100%;height:auto;object-fit:contain;border-radius:12px}
    .catalog-main .detail{padding:28px;border:1px solid #ffffff26;border-radius:14px;margin:24px 0;background:#ffffff04}
    .catalog-main .detail h2{font-size:1.65rem;margin:12px 0 22px}.catalog-main .detail h3{font-size:1.25rem;margin:16px 0}
    .catalog-main .detail p,.catalog-main .detail li,.catalog-main dd{font-size:1rem;line-height:1.8;margin-bottom:12px}
    .catalog-main ul,.catalog-main ol{padding-left:24px}.catalog-main dt{font-weight:700;margin-top:18px}.catalog-main dd{margin-left:0;opacity:.85}
    .catalog-main .pill{display:inline-block;padding:4px 10px;border:1px solid #ffffff30;border-radius:24px;margin:4px;font-size:.8rem}
    .catalog-main .button{margin:8px 8px 8px 0}.catalog-main .availability{display:inline-block;opacity:.7;margin:10px}
    .catalog-main .release{white-space:pre-wrap;padding:20px 0;border-bottom:1px solid #ffffff25}
    .catalog-main .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:22px}
    .catalog-main .grid img{max-width:100%;height:auto}.catalog-main figure{margin:0}.catalog-main details{padding:16px 0}.catalog-main summary{cursor:pointer}
    .catalog-main .project-grid{margin-top:35px!important}.catalog-main .project-card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:contain}
    .catalog-main .project-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch;gap:1px}
    .catalog-main .project-card{position:relative!important;opacity:1!important;transform:none!important;min-height:0!important;height:auto!important;width:auto!important;margin:0!important;will-change:auto}
    .catalog-main .project-card h2{font-size:2.5rem;line-height:1.1;margin:20px 0}.catalog-main .project-card .project-desc{line-height:1.7}
    .catalog-hai .catalog-main{padding-top:130px}
    .catalog-hai .catalog-main h1,.catalog-hai .catalog-main h2,.catalog-hai .catalog-main h3{font-family:'Barlow Condensed',sans-serif;text-transform:uppercase}
    .catalog-hai .catalog-main .catalog-title{font-size:clamp(4rem,10vw,8rem);font-weight:800;letter-spacing:-.04em}
    .catalog-hai #panel-projects{padding:0;max-width:none}.catalog-hai .catalog-main a{color:inherit}.catalog-hai .catalog-main .button{display:inline-block;border:1px solid #ffffff55;padding:12px 18px;text-decoration:none}
    .catalog-hai .catalog-main .button.primary{background:#a893ff;color:#090909;border-color:#a893ff}.catalog-hai .catalog-main .detail{border-radius:0}
    .catalog-portfolio .catalog-main .work-grid .project{margin-bottom:0}.catalog-portfolio .catalog-main .project{height:100%}
    .catalog-main a:focus-visible{outline:3px solid #c9b9ff;outline-offset:4px}
    @media(max-width:760px){.catalog-main{padding:35px 20px 60px}.catalog-hai .catalog-main{padding-top:110px}.catalog-main .catalog-hero{grid-template-columns:1fr;gap:25px}.catalog-main .detail{padding:20px}.catalog-main .project-grid{grid-template-columns:minmax(0,1fr)!important}}
  </style>`;
  const script=`<script>const menu=document.querySelector('.menu,#menuToggleBtn'),nav=document.querySelector('.navlinks,#mobileNav');if(menu&&nav){function closeMenu(){menu.setAttribute('aria-expanded','false');nav.classList.remove('open')}menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open)});nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus()}})}</script>`;
  return `<!doctype html><html lang="en"><head>${head}${styles}${fallback}${css}</head><body class="catalog-${isPortfolio?'portfolio':'hai'}"><a class="skip-link" href="#main">Skip to content</a>${header}<main class="catalog-main" id="main">${body}</main>${footer}${script}</body></html>`;
};
