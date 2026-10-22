'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const samples={
  dotflow:['Format a sample note','we agreed to review the prototype on friday. please share your feedback before then.'],
  hgpt:['Explore project memory','What did we decide about the prototype?'],
  h:['Ask about an application','How can I try Notewll?'],
  hagent:['Move an issue through a board','Review the prototype'],
  jobs:['Filter sample opportunities','engineer'],
  bizpack:['Normalize sample spreadsheet values','1,234.50\n$2,500\n(350.25)\nN/A'],
  morningstar:['Explore a classification example','The company builds software for business customers.'],
  portfolio:['Change the sample presentation','AI systems, from the model to deployment.'],
  analyst:['Analyze a small CSV','product,revenue\nAlpha,120\nBeta,180\nGamma,150'],
  hai:['Send messages in a local sample','Hello! Want to explore this project?'],
  agent:['Search a sample memory','prototype'],
  dating:['Explore a matching illustration',''],
  'tabula-rasa':['Explore a tiny grid','']
};
function runtime(id){
  const root=document.getElementById('project-demo');if(!root)return;
  const input=root.querySelector('[data-demo-input]'),output=root.querySelector('[data-demo-output]'),run=root.querySelector('[data-demo-run]'),reset=root.querySelector('[data-demo-reset]');
  const initial=input.value;let stage=0,messages=[],position=0;
  const show=(text)=>{output.textContent=text;};
  function execute(){
    const value=input.value.trim();
    if(!value&&!['dating','tabula-rasa'].includes(id)){show('Enter a sample to continue.');return;}
    switch(id){
      case 'dotflow':{
        const text=value.replace(/\s+/g,' ').replace(/(^|[.!?]\s+)([a-z])/g,(_,a,b)=>a+b.toUpperCase());
        const mode=root.querySelector('[data-demo-option]').value;
        show(mode==='email'?'Hi,\n\n'+text+'\n\nThanks!':mode==='bullets'?text.split(/(?<=[.!?])\s+/).map(s=>'- '+s).join('\n'):text);break;
      }
      case 'hgpt':{
        const saved=root.querySelector('[data-demo-option]').checked;
        show(saved?'Sample recalled memory: Prototype review is Friday.\n\nScripted response: We decided to review the prototype on Friday.\n\nContext trace: project / confirmed decision.':'Memory is off. The sample question has no saved project context.\n\nTurn on the confirmed memory to compare.');break;
      }
      case 'h':{
        const q=value.toLowerCase();
        show(q.includes('notewll')?'Sample response: Notewll is a Windows desktop app. Open its project guide for the installer and setup instructions.':q.includes('hgpt')?'Sample response: HGPT offers an isolated guest workspace. Use Open app in the project guide to try the actual workspace.':'This preview has two scripted topics: Notewll and HGPT. Try asking about one of them. The real assistant handles open-ended questions.');break;
      }
      case 'hagent':{
        const states=['Backlog','In progress','Review','Done'];stage=Math.min(stage+1,3);show('Sample issue: '+value+'\n\n'+states.map((s,i)=>(i===stage?'[ '+s+' ]':s)).join(' → ')+'\n\nThis moves a local card only. No agent is running.');break;
      }
      case 'jobs':{
        const jobs=[['ML Engineer','Remote'],['Data Analyst','Chicago'],['Software Engineer','New York']];
        const found=jobs.filter(j=>j.join(' ').toLowerCase().includes(value.toLowerCase()));show(found.length?found.map(j=>j[0]+' — '+j[1]).join('\n'):'No sample matches. Try engineer, analyst, Chicago or remote.');break;
      }
      case 'bizpack':{
        show(value.split('\n').map(line=>{
          const text=line.trim();if(/^(?:n\/?a|null|-)$/i.test(text))return text+' → missing';
          const clean=text.replace(/[$,\s]/g,'').replace(/^\((.*)\)$/,'-$1');
          return text+' → '+(/^-?\d+(?:\.\d+)?$/.test(clean)?Number(clean):'unrecognized');
        }).join('\n'));break;
      }
      case 'morningstar':{
        const examples={software:['The company builds software for business customers.','Illustrative category: Software'],bank:['The company accepts deposits and provides loans.','Illustrative category: Banking'],energy:['The company produces and supplies electricity.','Illustrative category: Energy']};
        const example=examples[root.querySelector('[data-demo-option]').value];show(example[0]+'\n\n'+example[1]+'\n\nA preset illustration of text → category. The trained classifier is not running here.');break;
      }
      case 'portfolio':{
        const card=root.querySelector('[data-demo-card]');card.hidden=false;card.textContent=value;
        card.style.background=root.querySelector('[data-demo-option]').value==='light'?'#f5f4ef':'#21182e';card.style.color=root.querySelector('[data-demo-option]').value==='light'?'#17121f':'#f5f0ff';show('The sample presentation changed. Your live portfolio content is unaffected.');break;
      }
      case 'analyst':{
        const lines=value.split(/\r?\n/).filter(l=>l.trim()),rows=lines.map(l=>l.split(','));
        if(rows.length<2||rows[0].length<2||rows.some(r=>r.length!==rows[0].length)||/["\r]/.test(value)){show('Use a simple CSV with a header and consistent comma-separated columns. Quoted fields are not supported in this small demo.');break;}
        const reports=rows[0].map((h,i)=>{
          const raw=rows.slice(1).map(r=>r[i].trim()),nums=raw.filter(s=>s!==''&&Number.isFinite(Number(s))).map(Number);
          return h.trim()+': '+(nums.length===raw.length?'total '+nums.reduce((a,b)=>a+b,0).toFixed(2)+', average '+(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2):new Set(raw).size+' distinct values');
        });show((rows.length-1)+' rows · '+rows[0].length+' columns\n\n'+reports.join('\n'));break;
      }
      case 'hai':messages.push('You: '+value);show(messages.join('\n\n')+'\n\nLocal sample only. No recipient, server delivery or encryption is involved.');input.value='';break;
      case 'agent':{
        const memories=['Prototype review is Friday.','Preferred workspace: local models.','Current project: a desktop notes tool.'];
        const terms=value.toLowerCase().split(/\s+/);const found=memories.filter(m=>terms.some(t=>m.toLowerCase().includes(t)));show('Sample memory search\n\n'+(found.join('\n')||'No sample memory matches. Try prototype, local or notes.'));break;
      }
      case 'dating':{
        const shared=Number(root.querySelector('[data-demo-option]').value);show('Fictional profiles share '+shared+' of 5 selected interests.\n\nIllustrative overlap: '+shared*20+'%\n\nThis is simple arithmetic, not the coursework model, a prediction or a measure of relationship compatibility.');break;
      }
      case 'tabula-rasa':{
        position=(position+1)%9;const grid=Array.from({length:9},(_,i)=>i===position?'●':i===8?'★':'·');show([grid.slice(0,3).join('  '),grid.slice(3,6).join('  '),grid.slice(6).join('  ')].join('\n')+'\n\nMove '+position+'/8'+(position===8?' — goal reached!':'')+'\n\nA toy illustration of action → observation. It does not run the research agent or reproduce its benchmarks.');break;
      }
      default:show('Select a workflow step below to explore the project.');
    }
  }
  run.addEventListener('click',execute);
  reset.addEventListener('click',()=>{input.value=initial;stage=0;messages=[];position=0;const option=root.querySelector('[data-demo-option]');if(option){if(option.type==='checkbox')option.checked=true;else option.selectedIndex=0;}root.querySelector('[data-demo-card]').hidden=true;show('Ready. Change the sample and run the demo.');});
  const steps=[...root.querySelectorAll('[data-demo-step]')];
  steps.forEach(button=>button.addEventListener('click',()=>{steps.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));root.querySelector('[data-demo-step-text]').textContent=button.getAttribute('data-step-text');}));
}
module.exports=function demo(p){
  const [title,sample]=samples[p.id]||['Explore the workflow','Sample'];
  const select=(options)=>'<label class="demo-option">Choose a sample <select data-demo-option>'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>';
  let option='';
  if(p.id==='dotflow')option=select([['note','Note'],['email','Email'],['bullets','Bullet points']]);
  if(p.id==='hgpt')option='<label class="demo-option"><input type="checkbox" data-demo-option checked> Include confirmed project memory</label>';
  if(p.id==='morningstar')option=select([['software','Software company'],['bank','Bank'],['energy','Energy company']]);
  if(p.id==='portfolio')option=select([['dark','Dark presentation'],['light','Light presentation']]);
  if(p.id==='dating')option=select([['1','1 shared interest'],['3','3 shared interests'],['5','5 shared interests']]);
  const hide=['dating','tabula-rasa','morningstar'].includes(p.id);
  return `<section class="detail project-demo" id="project-demo" aria-labelledby="demo-title"><p class="eyebrow">Interactive preview</p><h2 id="demo-title">Try a demo</h2><p>${esc(title)}. This is a small browser-only illustration, not the full application. AI responses are scripted; model and desktop features are not running here. Inputs stay on this page and reset when you reload.</p><div class="demo-workspace"><div><label ${hide?'hidden':''}>Sample input<textarea data-demo-input rows="5" maxlength="4000" spellcheck="false">${esc(sample)}</textarea></label>${option}<div><button class="button primary" type="button" data-demo-run>${p.id==='hagent'?'Advance issue':p.id==='tabula-rasa'?'Take next step':'Run demo'}</button><button class="button" type="button" data-demo-reset>Reset demo</button></div></div><div><h3>Result</h3><pre data-demo-output role="status" aria-live="polite">Ready. Change the sample and run the demo.</pre><div data-demo-card hidden class="demo-preview-card"></div></div></div><h3>Explore the real workflow</h3><div class="demo-steps">${p.workflow.map((s,i)=>`<button type="button" data-demo-step data-step-text="${esc(s)}" aria-pressed="${i===0}">Step ${i+1}</button>`).join('')}</div><p data-demo-step-text>${esc(p.workflow[0]||p.summary)}</p><p>The full app's capabilities and requirements are described below.</p><noscript><p>Enable JavaScript for the interactive sample. You can still read the complete workflow below.</p></noscript></section><style>.project-demo{scroll-margin-top:110px}.demo-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;margin:25px 0}.project-demo label{display:block}.project-demo label[hidden]{display:none}.project-demo textarea,.project-demo select{display:block;width:100%;max-width:100%;margin:10px 0 18px;padding:12px;background:#0c1016;color:#f3f3f7;border:1px solid #ffffff50;border-radius:4px;font:inherit}.project-demo .demo-option{margin:16px 0}.project-demo pre{white-space:pre-wrap;overflow-wrap:anywhere;min-height:130px;background:#080c12;border:1px solid #ffffff26;padding:18px;color:#e7edfa;font:14px/1.7 monospace}.demo-steps{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.demo-steps button{padding:10px 15px;background:transparent;border:1px solid #ffffff55;color:inherit;cursor:pointer}.demo-steps [aria-pressed="true"]{background:#a893ff;color:#090909}.project-demo button{cursor:pointer}.demo-preview-card{padding:24px;margin-top:16px;border:1px solid #ffffff40;font-size:1.5rem}.project-demo :focus-visible{outline:3px solid #c9b9ff;outline-offset:4px}@media(max-width:760px){.demo-workspace{grid-template-columns:minmax(0,1fr)}}</style><script>(${runtime.toString()})(${JSON.stringify(p.id)});</script>`;
};
