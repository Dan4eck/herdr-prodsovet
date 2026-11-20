import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({JSON,Object,String,Boolean,Number,Math,Map,Set,Error,Date,Promise,Array,RegExp});
let n=0;
async function test(name,fn){await fn();console.log(`ok ${++n} - ${name}`)}
const noop=()=>{};
const plain=x=>JSON.parse(JSON.stringify(x));
const elements=new Map();
function element(){const state={events:{}};let proxy;proxy=new Proxy(state,{get:(o,k)=>{
 if(k==='then')return undefined;if(k==='events')return o.events;
 return (...a)=>{if(k==='id'){o.id=a[0];elements.set(a[0],o);}if(String(k).startsWith('on_'))o.events[k]=a.at(-1);
 if(k==='when'&&a[0])a[1](proxy);return proxy;};}});return proxy;}
const input=()=>({text:'',events:{},value(){return this.text},set_value(v){this.text=v},on(k,fn){this.events[k]=fn},focus(){},set_loading(){}});
const calls=[];let responses=[];
const exec=async(cmd,args,opts)=>{calls.push([cmd,...args]);
 if(cmd==='git')return {code:0,stdout:'/repo\n',stderr:''};
 const r=responses.find(([match])=>match(args));if(r)return {code:0,stdout:typeof r[1]==='function'?r[1](args):r[1],stderr:''};
 return {code:1,stdout:'',stderr:'unexpected '+args.join(' ')};};
const host={spaces:()=>[{active:true,folder:'/repo',machine:null,id:'s1'}],panes:()=>[],focused:()=>({cwd:'/repo'}),exec,theme:()=>new Proxy({},{get:()=>'#777777'}),shared:()=>({}),notify:noop};
function shim(exports){return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context});}
const modules={
 'herdr':shim(host),'gpui-kit':shim({div:element,svg:element}),
 'gpui-base':shim({v_flex:element,h_flex:element,InputState:{new:input},Input:{new:element},TextareaState:{new:input},Textarea:{new:element}}),
 './appearance.js':shim({appearance:()=>({weights:{},fonts:{}}),fontSize:()=>12,metric:()=>30,radius:x=>x,labelFont:()=>null,style:()=>false,L:en=>en}),
 './filesystem.js':shim({openExternal:async()=>null,pasteInto:async()=>null}),
};
const mod=new vm.SourceTextModule(fs.readFileSync(new URL('../mods/prodsovet/issues.js',import.meta.url),'utf8'),{context});
await mod.link(s=>modules[s]);await mod.evaluate();
const {Issues,listArgs,numberFromUrl,explain}=mod.namespace;
const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
const has=(args,...want)=>want.every((w,i)=>args[i]===w);
const issue={number:7,title:'Fix login',body:'Steps\n## Expected',url:'https://github.com/o/r/issues/7',state:'OPEN',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),author:{login:'dan'},labels:[{name:'bug',color:'d73a4a'}],assignees:[],comments:[{author:{login:'bot'},body:'hi',createdAt:new Date().toISOString()}]};
responses=[
 [a=>has(a,'repo','view'),JSON.stringify({nameWithOwner:'o/r',url:'https://github.com/o/r'})],
 [a=>has(a,'issue','list'),JSON.stringify([issue])],
 [a=>has(a,'label','list'),JSON.stringify([{name:'bug',color:'d73a4a'},{name:'idea',color:'a2eeef'}])],
 [a=>has(a,'api','user'),'dan\n'],
 [a=>has(a,'issue','view'),JSON.stringify(issue)],
 [a=>has(a,'issue','create'),'https://github.com/o/r/issues/7\n'],
 [a=>has(a,'issue','comment')||has(a,'issue','close')||has(a,'issue','edit')||has(a,'issue','reopen'),''],
];
function setup(){const cx={notify:noop,stop_propagation:noop,timer:{every:noop,after:noop},spawn(fn){fn(cx)}};const p=new Issues();p.init({},cx);return {p,cx};}
await test('filters map to gh issue list arguments',()=>{
 assert.deepEqual(plain(listArgs({state:'open',mine:false,search:''}).slice(0,4)),['issue','list','--state','open']);
 const a=listArgs({state:'closed',mine:true,search:' label:bug '});
 assert.ok(a.includes('closed'));assert.equal(a[a.indexOf('--assignee')+1],'@me');assert.equal(a[a.indexOf('--search')+1],'label:bug');
 assert.equal(numberFromUrl('https://github.com/o/r/issues/42\n'),42);assert.equal(numberFromUrl('nope'),null);
 assert.match(explain('To get started with GitHub CLI, please run: gh auth login'),/gh auth login/);
});
await test('the list loads repo, issues, labels and the login',async()=>{
 const {p,cx}=setup();await flush();
 assert.equal(p.repo.nameWithOwner,'o/r');assert.equal(p.list.length,1);assert.equal(p.labels.length,2);assert.equal(p.me,'dan');
 p.render(cx);assert.ok(elements.has('issue-row-7'));
});
await test('a new issue is created with labels and assignee, then shown',async()=>{
 const {p,cx}=setup();await flush();p.newIssue(cx);assert.equal(p.view,'form');
 p.save(cx);assert.match(p.note,/title/);
 p.title.text='Add issues tab';p.body.text='So I can track work';p.draftLabels.add('idea');p.draftAssign=true;calls.length=0;p.save(cx);await flush();
 const create=calls.find(c=>c[1]==='issue'&&c[2]==='create');
 assert.deepEqual(create.slice(1),['issue','create','--title','Add issues tab','--body','So I can track work','--label','idea','--assignee','@me']);
 assert.equal(p.view,'issue');assert.equal(p.issue.number,7);
});
await test('comment, guarded close and label toggle run the right gh commands',async()=>{
 const {p,cx}=setup();await flush();p.show(7,cx);await flush();p.render(cx);
 p.comment.text='On it';calls.length=0;p.send(cx);await flush();
 assert.deepEqual(calls.find(c=>c[2]==='comment').slice(1),['issue','comment','7','--body','On it']);assert.equal(p.comment.text,'');
 p.render(cx);calls.length=0;elements.get('issue-close').events.on_click({},cx);await flush();assert.ok(!calls.some(c=>c[2]==='close'));
 p.render(cx);elements.get('issue-close').events.on_click({},cx);await flush();assert.ok(calls.some(c=>c[2]==='close'&&c[3]==='7'));
 p.render(cx);calls.length=0;elements.get('issue-toggle-1').events.on_click({},cx);await flush();
 assert.deepEqual(calls.find(c=>c[2]==='edit').slice(1),['issue','edit','7','--add-label','idea']);
 p.render(cx);calls.length=0;elements.get('issue-toggle-0').events.on_click({},cx);await flush();
 assert.deepEqual(calls.find(c=>c[2]==='edit').slice(1),['issue','edit','7','--remove-label','bug']);
});
await test('editing sends only the label and assignee differences',async()=>{
 const {p,cx}=setup();await flush();p.show(7,cx);await flush();p.edit(cx);assert.equal(p.title.text,'Fix login');
 p.draftLabels.delete('bug');p.draftLabels.add('idea');p.draftAssign=true;calls.length=0;p.save(cx);await flush();
 const e=calls.find(c=>c[2]==='edit').slice(1);
 assert.deepEqual(e,['issue','edit','7','--title','Fix login','--body','Steps\n## Expected','--add-label','idea','--remove-label','bug','--add-assignee','@me']);
});
await test('a gh failure shows as a note and keeps the view',async()=>{
 const {p,cx}=setup();await flush();p.show(7,cx);await flush();
 const saved=responses;responses=responses.filter(r=>!r[0](['issue','comment']));p.comment.text='x';p.send(cx);await flush();
 assert.ok(p.note);assert.equal(p.view,'issue');responses=saved;
});
