const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/demo.js','utf8');
const code=source.slice(source.indexOf('function recorderRuntime(){'),source.indexOf('function voiceDemo(){'))+'recorderRuntime();';
function setup(getMedia){
 const nodes={};for(const key of ['[data-record]','[data-reset-recording]','[data-record-status]','audio','[data-record-download]'])nodes[key]={events:{},hidden:true,disabled:false,textContent:'',attrs:{},addEventListener(k,f){this.events[k]=f;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},pause(){}};
 let stopped=0;const stream={getTracks:()=>[{stop(){stopped++;}}]};
 class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';this.events={};}addEventListener(k,f){this.events[k]=f;}start(){this.state='recording';}stop(){this.state='inactive';this.events.dataavailable({data:new Blob(['sample'],{type:'audio/webm'})});this.events.stop();}}
 const ctx={document:{getElementById:()=>({querySelector:k=>nodes[k]}),addEventListener(){}},navigator:{mediaDevices:{getUserMedia:getMedia||(()=>Promise.resolve(stream))}},MediaRecorder:Recorder,Blob,URL:{createObjectURL:()=> 'blob:test-audio',revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},window:{addEventListener(){}}};
 vm.runInNewContext(code,ctx);return {nodes,stream,stopped:()=>stopped};
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let h=setup(),button=h.nodes['[data-record]'];button.events.click();await flush();assert.equal(button.attrs['aria-pressed'],'true');button.events.click();assert(h.stopped()>0);assert.equal(h.nodes.audio.src,'blob:test-audio');assert.equal(h.nodes['[data-record-download]'].download,'notewll-voice-note.webm');h.nodes['[data-reset-recording]'].events.click();assert(h.nodes.audio.hidden);console.log('PASS start, stop, playback, download and reset');
 let grant;h=setup(()=>new Promise(r=>{grant=r;}));button=h.nodes['[data-record]'];button.events.keydown({code:'Space',repeat:false,preventDefault(){}});button.events.keyup({code:'Space',preventDefault(){}});grant(h.stream);await flush();assert(h.stopped()>0);assert.notEqual(button.attrs['aria-pressed'],'true');console.log('PASS shortcut release cancels pending microphone access');
 h=setup(()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'})));h.nodes['[data-record]'].events.click();await flush();assert(h.nodes['[data-record-status]'].textContent.includes('not allowed'));console.log('PASS microphone permission denial');
})().catch(e=>{console.error(e);process.exitCode=1;});
