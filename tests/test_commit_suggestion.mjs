import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({JSON,Object,String,Boolean,Number,Math,Map,Error});
const source=fs.readFileSync(new URL('../mods/prodsovet/commit-suggestion.js',import.meta.url),'utf8');
const module=new vm.SourceTextModule(source,{context});await module.link(()=>{});await module.evaluate();
const {CommitSuggestion,changesShown}=module.namespace;
let n=0;
async function test(name,fn){await fn();console.log(`ok ${++n} - ${name}`)}
const snap=(fingerprint='one')=>({fingerprint,text:'diff',empty:false,conflict:false});
const noop=()=>{};
await test('unchanged diff reuses one generated subject',async()=>{
 let generations=0;const s=new CommitSuggestion(async mode=>mode==='snapshot'?snap():{message:`Fix root ${++generations}`});
 await s.update('/repo','en',()=>true,noop);await s.update('/repo','en',()=>true,noop);
 assert.equal(generations,1);assert.equal(s.value,'Fix root 1');
});
await test('diff changed during generation discards stale result',async()=>{
 let reads=0;const s=new CommitSuggestion(async mode=>mode==='snapshot'?snap(++reads===1?'one':'two'):{message:'Outdated'});
 await s.update('/repo','en',()=>true,noop);assert.equal(s.value,'');assert.equal(s.fingerprint,null);
});
await test('late result cannot leak across spaces',async()=>{
 let finish;const pending=new Promise(r=>finish=r);const s=new CommitSuggestion(async mode=>mode==='snapshot'?snap():pending);
 const task=s.update('/old','en',()=>true,noop);await Promise.resolve();s.reset();finish({message:'Old repo'});await task;
 assert.equal(s.value,'');assert.equal(s.busy,false);
});
await test('no generation for empty or conflicting trees',async()=>{
 for(const flag of ['empty','conflict']){let generations=0;const s=new CommitSuggestion(async mode=>mode==='snapshot'?{...snap(),[flag]:true}:++generations);
 await s.update('/repo','en',()=>true,noop);assert.equal(generations,0);assert.equal(s.value,'');}
});
await test('failed generation is not retried every refresh',async()=>{
 let count=0;const s=new CommitSuggestion(async mode=>{if(mode==='snapshot')return snap();count++;throw Error('login');});
 await s.update('/repo','en',()=>true,noop);await s.update('/repo','en',()=>true,noop);
 assert.equal(count,1);assert.equal(s.error,'login');s.tried=null;await s.update('/repo','en',()=>true,noop);assert.equal(count,2);
});
// Exercise the real panel handlers with a native-host shim; no Git writes.
const elements=new Map();
function element(){const state={};let proxy;proxy=new Proxy(state,{get:(o,k)=>k==='then'?undefined:(...a)=>{
 if(k==='id'){o.id=a[0];elements.set(a[0],o);}if(k==='on_key_down')o.key=a[0];
 if(k==='when'&&a[0])a[1](proxy);return proxy;
 }});return proxy;}
const input=()=>({text:'',events:{},value(){return this.text},set_value(v){this.text=v},on(k,fn){this.events[k]=fn},focus(){},set_loading(){}});
const host={spaces:()=>[{active:true,folder:'/repo',machine:null}],panes:()=>[],focused:()=>({cwd:'/repo'}),exec:async()=>{throw Error('Unexpected exec')},readTextFile:noop,watchFolder:noop,theme:()=>({}),settings:()=>({}),appHome:()=>'/app',layout:()=>shownLayout,window:()=>({active:true})};
let shownLayout={id:'root',children:[{id:'panel',children:[{id:'panel-body',type:'stack',active:'changes',children:[{id:'files'},{id:'changes'}]}]}]};
function shim(exports){return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context});}
const modules={
 'herdr':shim(host),'gpui-kit':shim({div:element,svg:element}),
 'gpui-base':shim({v_flex:element,h_flex:element,InputState:{new:input},Input:{new:element},Scrollbar:{vertical:element},v_virtual_list:element}),
 './appearance.js':shim({appearance:()=>({weights:{},fonts:{}}),fontSize:()=>12,metric:()=>30,radius:x=>x,labelFont:()=>null,style:()=>false,L:en=>en}),
 './filesystem.js':shim({fileGlyph:()=>({}),python:(...a)=>host.exec('python3',...a)}),'./commit-suggestion.js':module,
};
const panel=new vm.SourceTextModule(fs.readFileSync(new URL('../mods/prodsovet/changes.js',import.meta.url),'utf8'),{context});
await panel.link(s=>modules[s]);await panel.evaluate();const {Changes}=panel.namespace;
function setup(){
 const tasks=[];const cx={focus_handle:()=>({focus(){}}),notify:noop,stop_propagation:noop,timer:{every:noop,after:noop},spawn(fn){tasks.push(fn(cx))}};
 const p=new Changes();p.refresh=noop;p.init({},cx);p.root='/repo';p.context=JSON.stringify({cwd:'/repo',on:null});
 p.suggestion.value='Fix root discovery';p.suggestion.fingerprint='one';p.suggestion.call=async()=>snap();
 return {p,cx,tasks};
}
await test('generated message fills the input without creating a commit or a shortcut hint',async()=>{
 const {p,cx}=setup();let commits=0;p.commit=()=>commits++;p.syncSuggestion(cx);p.render(cx);
 assert.equal(p.input.value(),'Fix root discovery');assert.equal(p.messageOrigin,'auto');assert.equal(commits,0);
 assert.equal(elements.has('commit-suggestion'),false);
 p.input.events.submit({},cx);assert.equal(commits,1);
});
await test('manual edits and manual clearing survive new generated results',async()=>{
 const {p,cx}=setup();p.syncSuggestion(cx);p.input.text='My own message';p.input.events.change({},cx);
 p.suggestion.value='New result';p.syncSuggestion(cx);assert.equal(p.message,'My own message');
 p.input.text='';p.input.events.change({},cx);p.syncSuggestion(cx);assert.equal(p.message,'');assert.equal(p.messageOrigin,'manual');
});
await test('programmatic change event does not disable future autofill',async()=>{
 const {p,cx}=setup();p.syncSuggestion(cx);p.input.events.change({},cx);assert.equal(p.messageOrigin,'auto');
 p.suggestion.value='Updated result';p.syncSuggestion(cx);assert.equal(p.message,'Updated result');
});
await test('outdated generated text is cleared while a new message is composed',async()=>{
 const {p,cx}=setup();p.syncSuggestion(cx);p.suggestion.value='';p.suggestion.busy=true;p.syncSuggestion(cx);
 assert.equal(p.message,'');assert.equal(p.input.value(),'');
});
await test('commit refuses an autofilled subject when the diff changed',async()=>{
 const {p,cx,tasks}=setup();p.syncSuggestion(cx);p.suggestion.call=async()=>snap('changed');p.commit(cx);await Promise.all(tasks);
 assert.equal(p.message,'');assert.match(p.note,/Changes updated/);assert.equal(p.busy,false);
});
console.log(`${n} commit suggestion tests passed`);
await test('suggestions run only while the Changes panel is on screen',()=>{
 const tree=(hidden,active)=>({id:'root',children:[{id:'panel',hidden,children:[{id:'panel-body',type:'stack',active,children:[{id:'files'},{id:'changes'}]}]}]});
 assert.equal(changesShown(tree(false,'changes'),{active:true}),true);
 assert.equal(changesShown(tree(false,'files'),{active:true}),false);
 assert.equal(changesShown(tree(true,'changes'),{active:true}),false);
 assert.equal(changesShown(tree(false,'changes'),{active:false}),false);
 assert.equal(changesShown({id:'root',children:[]},{active:true}),true);
});
await test('a hidden Changes panel schedules no generation and catches up when shown',async()=>{
 const {p,cx}=setup();let timers=0;cx.timer.after=()=>timers++;p.files=[{path:'a',status:'M'}];p.messageOrigin='empty';
 shownLayout.children[0].children[0].active='files';p.suggest(cx);assert.equal(timers,0);
 p.render(cx);assert.equal(timers,0);
 shownLayout.children[0].children[0].active='changes';p.render(cx);assert.equal(timers,1);
});
