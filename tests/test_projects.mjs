import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'herdr-projects-'));
const plain=x=>JSON.parse(JSON.stringify(x));
const state=new Map([['layout','PA-Advanced'],['ui.lang','ru']]);
const storage=new Map(), calls=[], pending=[];
let sp=[], ps=[], ts=[], ag=[], pr={role:'projects'}, width=341, order=[], machineList=[{name:null,layout:'ready'}], agentHosts=[], picker=async()=>null;
let execFixture=null;
function element(type='div') {
 const node={type,_children:[],events:{},attrs:{}};
 const proxy=new Proxy(node,{get(target,key){
   if(key in target)return target[key];
   if(key==='then')return undefined;
   return (...args)=>{
     if(key==='when'){if(args[0])args[1](proxy);}
     else if(key==='child')node._children.push(args[0]);
     else if(key==='children')node._children.push(...args[0]);
     else if(String(key).startsWith('on_'))node.events[key]=args.at(-1);
     else node.attrs[key]=args.length===1?args[0]:args;
     return proxy;
   };
 }});return proxy;
}
const theme=()=>new Proxy({}, {get:()=> '#777777'});
const host={
 spaces:()=>sp,panes:()=>ps,terminals:()=>ts,agents:()=>ag.map(a=>({...a})),props:()=>pr,
 machines:()=>machineList,focused:()=>({space:'main',agent:'a1'}),
 shared:k=>state.get(k),setShared:(k,v)=>state.set(k,v),home:()=>'/home/test',appHome:()=>root,
 settings:()=>({dark:true}),window:()=>({active:true,platform:process.platform==='win32'?'windows':'macos'}),theme,
 layout:()=>({id:'sidebar',size:{px:width}}),setAgentOrder:x=>order=x,
 run:(name,args)=>calls.push({name,args}),openOverlay:p=>calls.push({overlay:p}),closeOverlay:id=>calls.push({close:id}),
 knownAgents:async({on})=>{agentHosts.push(on);return [{key:'codex',name:'Codex',run:['codex'],installed:true}];},pickFolder:()=>picker(),keys:()=>[],
 exec:async(cmd,args,opts)=>{
   if(execFixture)return execFixture(cmd,args,opts);
   if(cmd==='test')return {code:0,stdout:'',stderr:''};
   if(['py','python','python3'].includes(cmd)){const r=spawnSync(cmd,args,{encoding:'utf8'});return {code:r.status??1,stdout:r.stdout??'',stderr:r.stderr??String(r.error??'')};}
   if(opts?.cwd?.startsWith(temp)) {const r=spawnSync(cmd,args,{cwd:opts.cwd,encoding:'utf8'});return {code:r.status??1,stdout:r.stdout??'',stderr:r.stderr??String(r.error??'')};}
   return {code:1,stdout:'',stderr:'unavailable'};
 }
};
const ctx=vm.createContext({console,Date,JSON,Object,String,Number,Set,Map,Error,Boolean,Math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
const cache=new Map();
function synth(name,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context:ctx,identifier:name});cache.set(name,m);}
synth('herdr',host);
synth('gpui-kit',{View:class {},div:()=>element(),svg:p=>element('svg').path(p),image:p=>element('image').path(p)});
synth('gpui-base',{v_flex:()=>element('v'),h_flex:()=>element('h'),ScrollHandle:{new:()=>({scroll_to_item(){}})},InputState:{new:({value})=>({text:value,events:{},value(){return this.text;},set_value(v){this.text=v;},on(name,fn){this.events[name]=fn;},focus(){}})},Input:{new:()=>element('input')}});
async function load(name){if(cache.has(name))return cache.get(name);const m=new vm.SourceTextModule(fs.readFileSync(name,'utf8'),{context:ctx,identifier:name});cache.set(name,m);await m.link((s,ref)=>load(s.startsWith('.')?path.resolve(path.dirname(ref.identifier),s):s));return m;}
const model=await load(path.join(root,'mods/prodsovet/project-model.js'));await model.evaluate();
const {inspectCheckout,projectGroups,pathKey}=model.namespace;
const mod=await load(path.join(root,'mods/prodsovet/agents.js'));await mod.evaluate();
const menu=await load(path.join(root,'mods/prodsovet/file-new-menu.js'));await menu.evaluate();
const tabsModule=await load(path.join(root,'mods/prodsovet/file-tabs.js'));await tabsModule.evaluate();
const openerModule=await load(path.join(root,'mods/prodsovet/open-project.js'));await openerModule.evaluate();
const contextModule=await load(path.join(root,'mods/prodsovet/project-context.js'));await contextModule.evaluate();
const cx={notify(){},stop_propagation(){},timer:{every(){},after(){}},focus_handle:()=>({focus(){}}),spawn(fn){const p=fn(cx);pending.push(p);return p;}};
async function flush(){while(pending.length)await Promise.all(pending.splice(0));}
const nodes=n=>typeof n==='object'&&n?[n,...n._children.flatMap(nodes)]:[];
const byId=(tree,id)=>nodes(tree).find(n=>n.attrs.id===id);
const text=n=>typeof n==='string'||typeof n==='number'?String(n):n?._children?.map(text).join(' ')??'';
const git=(cwd,...args)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
let n=0;
async function test(name,fn){await fn();console.log(`ok ${++n} - ${name}`);}
try {
 const repo=path.join(temp,'project'),wt=path.join(temp,'feature');fs.mkdirSync(repo);
 git(repo,'init','-q');git(repo,'-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','initial');
 git(repo,'worktree','add','-qb','feature/dashboard',wt);
 const main=await inspectCheckout(host.exec,repo,null),linked=await inspectCheckout(host.exec,wt,null);
 await test('real Git links checkout to its main repository, not its folder name',()=>{
   assert.equal(main.repo,linked.repo);assert.equal(main.linked,false);assert.equal(linked.linked,true);assert.equal(linked.branch,'feature/dashboard');
 });
 await test('unavailable checkout keeps its last verified identity',async()=>{
   const fail=async()=>{throw Error('offline');};const result=await inspectCheckout(fail,wt,null,linked);
   assert.equal(result.repo,main.repo);assert.equal(result.unavailable,true);
 });
 const entry=(id,cwd,meta,machine=null)=>({space:{id,machine,tabs:[]},cwd,meta,label:id,members:[]});
 await test('Windows drive and UNC aliases share project and checkout identities',async()=>{
   for(const [first,second] of [['C:/Work/Project','c:\\work\\project'],['//Server/Share/Project','\\\\server\\share\\project']]) {
     const inspect=async(folder,common)=>inspectCheckout(async(_cmd,args)=>({code:0,stdout:args.includes('--show-toplevel')?folder:args.includes('--git-common-dir')?common:'main'}),folder,null);
     const a=await inspect(first,second+'/.git'),b=await inspect(second,first+'/.git');
     assert.equal(a.linked,false);assert.equal(b.linked,false);
     const groups=projectGroups([entry('a',first,a),entry('b',second,b)]);
     assert.equal(groups.length,1);assert.equal(groups[0].checkouts.length,1);assert.equal(groups[0].checkouts[0].spaces.length,2);
     assert.equal(pathKey(null,first+'/'),pathKey(null,second));
     assert.notEqual(pathKey(null,first),pathKey('server',second));
   }
   assert.notEqual(pathKey(null,'/Work/Project'),pathKey(null,'/work/project'));
 });
 await test('opening a Windows path alias reuses its existing Space and tabs',async()=>{
   const savedSpaces=sp,savedState=new Map(state),savedProps=pr;
   const existing='C:\\Work\\Project',typed='c:/work/project';
   sp=[{id:'win',active:true,folder:existing,machine:null,tabs:[{id:'win-tab',active:true}]},
       {id:'alias',folder:typed,machine:null,tabs:[{id:'alias-tab'}]}];
   state.set('files.workspace-roots',{win:existing,alias:typed});
   execFixture=(cmd,args,opts)=>{
     if(['py','python','python3'].includes(cmd)) return {code:0,stdout:args.includes('-c')?'3':JSON.stringify({path:typed})};
     if(cmd==='pwd')return {code:0,stdout:typed};
     if(cmd==='git')return {code:0,stdout:args.includes('--show-toplevel')?opts.cwd:args.includes('--git-common-dir')?opts.cwd+'/.git':'main'};
     throw Error('Unexpected command: '+cmd);
   };
   try {
     assert.deepEqual(plain(contextModule.namespace.checkoutContext().tabs.map(t=>t.id)),['win-tab','alias-tab']);
     pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
     dialog.path=typed;calls.length=0;dialog.submit(cx);await flush();
     assert.ok(!dialog.error,dialog.error);assert.ok(!calls.some(c=>c.name==='space.new'));
     assert.equal(calls.find(c=>c.name==='space.select')?.args.id,'win');
   } finally {execFixture=null;sp=savedSpaces;pr=savedProps;state.clear();for(const [k,v] of savedState)state.set(k,v);calls.length=0;}
 });
 await test('worktree stays in its repository group after the main space closes',()=>{
   const groups=projectGroups([entry('wt',wt,linked)]);assert.equal(groups[0].name,'project');assert.equal(groups[0].checkouts[0].meta.linked,true);
 });
 await test('same paths on another machine and equal repo names do not merge',()=>{
   const groups=projectGroups([entry('main',repo,main),entry('wt',wt,linked),entry('remote',repo,main,'server'),entry('clone','/other/project',{...main,repo:'/other/project/.git',main:'/other/project',root:'/other/project'})]);assert.equal(groups.length,3);
 });
 await test('duplicate spaces share one checkout and pins stay inside it',()=>{
   const a=entry('main',repo,main),b=entry('second',repo,main),c=entry('wt',wt,linked);
   a.members=[{address:'a'}];b.members=[{address:'b',pinned:true}];c.members=[{address:'c',pinned:true}];
   const g=projectGroups([c,a,b])[0];assert.equal(g.checkouts.length,2);assert.deepEqual(plain(g.checkouts[0].members.map(a=>a.address)),['b','a']);
 });
 sp=[{id:'main',name:'~',machine:null,folder:'/home/test',active:true,tabs:[{id:'shell',name:'1'},{id:'agent',name:'2'},{id:'doc',name:'notes.md'}]},
     {id:'wt',name:'feature',machine:null,folder:wt,tabs:[{id:'feature',name:'1'},{id:'child',name:'2'}]}];
 ps=[{pane:'p0',tab:'shell',terminal:'shell',cwd:'/home/test',program:{shell:true,name:'zsh',key:'zsh'}},
     {pane:'p1',tab:'agent',terminal:'a1',cwd:repo,program:{agent:true,name:'Codex',key:'codex'},title:'Task'},
     {pane:'p2',tab:'feature',terminal:'a2',cwd:wt,program:{agent:true,name:'Codex',key:'codex'}},
     {pane:'p3',tab:'child',terminal:'a3',cwd:wt,program:{agent:true,name:'Claude',key:'claude-code'}},
     {pane:'pd',tab:'doc',mod:'file-tab'}];
 ts=ps.filter(p=>p.terminal).map(p=>({address:p.terminal,state:'live',program:p.program,parent:p.terminal==='a3'?'a2':null}));
 ag=ps.filter(p=>p.program?.agent).map(p=>({...p,address:p.terminal,space:p.tab==='agent'?'main':'wt',space_name:'~',status:p.terminal==='a3'?'blocked':'idle',pinned:false}));
 state.set('files.workspace-roots',{main:repo,wt});state.set('projects.checkouts.v1',{[pathKey(null,repo)]:main,[pathKey(null,wt)]:linked});
 const owner=new mod.namespace.Agents();owner.init({},cx);await flush();
 let tree=owner.render(cx);await flush();
 const pid=`project-${pathKey(null,main.repo)}`,cid=`checkout-${pathKey(null,linked.root)}`;
 await test('unified view groups with stable roots even when first terminal is at home',()=>{
   assert.ok(byId(tree,pid));assert.ok(byId(tree,cid));assert.ok(!text(tree).includes('МАСТЕРСКАЯ'));assert.ok(text(tree).includes('ПРОЕКТЫ'));
   assert.ok(!byId(tree,'ag-shell'));assert.ok(!byId(tree,'project-tab-doc'));assert.ok(byId(tree,'ag-a1'));
 });
 await test('adopted sub-agent appears exactly once beneath its parent and navigation includes it',()=>{
   assert.equal(nodes(tree).filter(n=>n.attrs.id==='sub-a3').length,1);assert.equal(nodes(tree).filter(n=>n.attrs.id==='ag-a3').length,0);
   assert.deepEqual(plain(order),['a1','a2','a3']);
 });
 await test('checkout fold is persistent and keeps project and other sessions visible',()=>{
   byId(tree,`${cid}-fold`).events.on_click({},cx);tree=owner.render(cx);
   assert.ok(!byId(tree,'ag-a2'));assert.ok(byId(tree,'ag-a1'));assert.ok(state.get('projects.folded.v1').includes(cid));
   byId(tree,`${cid}-fold`).events.on_click({},cx);tree=owner.render(cx);
 });
 await test('session and project clicks address the correct existing pane and space',()=>{
   calls.length=0;byId(tree,'ag-a2').events.on_click();byId(tree,pid).events.on_click();
   assert.deepEqual(plain(calls),[{name:'pane.focus',args:{pane:'p2'}},{name:'space.select',args:{id:'main'}}]);
 });
 await test('plus targets the clicked checkout without changing active space',async()=>{
   calls.length=0;byId(tree,`${cid}-add`).events.on_click({},cx);assert.equal(calls[0].overlay.props.space,'wt');
   pr=calls[0].overlay.props;const m=new menu.namespace.default();m.init({},cx);await flush();const mt=m.render();
   byId(mt,'worktree').events.on_click();assert.equal(calls.at(-1).overlay.props.folder,wt);
   calls.length=0;byId(mt,'codex').events.on_click();assert.equal(calls.at(-1).args.space,'wt');assert.equal(calls.at(-1).args.folder,wt);pr={role:'projects'};
 });
 await test('cross-checkout adopted child remains under its own worktree',()=>{
   ts.find(t=>t.address==='a2').parent='a1';tree=owner.render(cx);assert.ok(byId(tree,'ag-a2'));assert.ok(!byId(tree,'sub-a2'));ts.find(t=>t.address==='a2').parent=null;
 });
 await test('pinning an adopted sub-agent never duplicates it in the project tree',()=>{
   ag.find(a=>a.address==='a3').pinned=true;tree=owner.render(cx);
   assert.equal(nodes(tree).filter(n=>n.attrs.id==='sub-a3').length,1);assert.ok(!byId(tree,'ag-a3'));
   ag.find(a=>a.address==='a3').pinned=false;
 });
 await test('newly opened worktree is discovered and persisted without a layout reload',async()=>{
   const second=path.join(temp,'another');git(repo,'worktree','add','-qb','second',second);
   sp.push({id:'new',name:'second',machine:null,folder:second,tabs:[]});
   owner.render(cx);await flush();tree=owner.render(cx);
   const metadata=state.get('projects.checkouts.v1')[pathKey(null,second)];
   assert.equal(metadata.repo,main.repo);assert.ok(byId(tree,`checkout-${pathKey(null,metadata.root)}`));
   sp.pop();
 });
 await test('legacy missing managed checkout is grouped once and retains provenance',()=>{
   const missing='/home/test/.herdr/worktrees/project/old';
   sp.push({id:'old',name:'old',machine:null,folder:missing,tabs:[]});
   owner.projects.cache[pathKey(null,missing)]={cwd:missing,on:null,unavailable:true};
   owner.projects.checked.set(pathKey(null,missing),Date.now());
   tree=owner.render(cx);assert.ok(byId(tree,`checkout-${pathKey(null,missing)}`));
   assert.ok(text(tree).includes('Папка недоступна'));
   assert.equal(state.get('projects.checkouts.v1')[pathKey(null,missing)].inferred,true);
   sp.pop();
 });
 await test('narrow sidebar retains navigation for projects without agents',()=>{
   width=76;tree=owner.render(cx);assert.ok(byId(tree,pid));assert.ok(!byId(tree,'ag-shell'));width=341;
 });
 await test('one global project action opens a chooser, machine headers have no duplicate plus',()=>{
   tree=owner.render(cx);calls.length=0;
   byId(tree,'project-new').events.on_click({},cx);
   assert.equal(calls.at(-1).overlay.props.role,'open-project');
   assert.equal(nodes(tree).filter(n=>String(n.attrs.id).startsWith('projects-machine-add-')).length,0);
 });
 await test('project session menu cannot create an unrelated blank project',async()=>{
   pr={role:'new-menu',space:'main'};const m=new menu.namespace.default();m.init({},cx);await flush();
   const mt=m.render();assert.ok(!byId(mt,'space'));assert.ok(byId(mt,'terminal'));assert.ok(text(mt).includes(repo));pr={role:'projects'};
 });
 await test('duplicate native Spaces expose all checkout tabs, with exactly one active tab',()=>{
   sp[0].tabs.find(t=>t.id==='agent').active=true;
   sp.push({id:'duplicate',name:'project',folder:repo,machine:null,tabs:[{id:'extra-shell',name:'1',active:true}]});
   const context=contextModule.namespace.checkoutContext();
   assert.deepEqual(plain(context.tabs.map(t=>t.id)),['shell','agent','doc','extra-shell']);
   assert.equal(context.tabs.filter(t=>t.active).length,1);assert.ok(!context.tabs.some(t=>t.id==='feature'));
   const tabs=new tabsModule.namespace.default();tabs.init();const bar=tabs.render();
   assert.ok(byId(bar,'tab-extra-shell'));assert.ok(byId(bar,'tab-shell'));assert.ok(byId(bar,'tab-doc'));
   calls.length=0;byId(bar,'tab-extra-shell').events.on_mouse_up();
   assert.deepEqual(plain(calls),[{name:'space.select',args:{id:'duplicate'}},{name:'tab.select',args:{id:'extra-shell'}}]);
   calls.length=0;contextModule.namespace.nextProjectTab(1);assert.equal(calls.at(-1).args.id,'doc');
   sp[0].active=false;sp.at(-1).active=true;calls.length=0;contextModule.namespace.nextProjectTab(1);
   assert.deepEqual(plain(calls),[{name:'space.select',args:{id:'main'}},{name:'tab.select',args:{id:'shell'}}]);
   sp[0].active=true;sp.pop();
 });
 await test('opening an already open project switches to it without creating a Space or terminal',async()=>{
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   dialog.path=repo;calls.length=0;dialog.submit(cx);await flush();
   assert.equal(calls.filter(c=>c.name==='space.new').length,0);assert.equal(calls.find(c=>c.name==='space.select').args.id,'main');
   dialog.render();pr={role:'projects'};
 });
 await test('new project starts the chosen agent directly with explicit folder and machine',async()=>{
   const newFolder=path.join(temp,'new project');fs.mkdirSync(newFolder);
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   dialog.path=newFolder;dialog.choice='codex';calls.length=0;dialog.submit(cx);await flush();
   const create=calls.find(c=>c.name==='space.new');assert.ok(create);assert.equal(create.args.machine,'');
   assert.equal(create.args.folder,fs.realpathSync(newFolder));assert.deepEqual(plain(create.args.argv),['codex']);
   assert.equal(create.args.tab,'Codex');pr={role:'projects'};
 });
 await test('terminal is the default before and after discovery, and Finder confirmation opens immediately',async()=>{
   const folder=path.join(temp,'finder-default');fs.mkdirSync(folder);
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);
   assert.equal(dialog.choice,'terminal');await flush();assert.equal(dialog.choice,'terminal');
   const ui=dialog.render();assert.ok(!byId(ui,'project-open'));
   const ids=nodes(ui).map(n=>n.attrs.id);assert.ok(ids.indexOf('project-agent-terminal')<ids.indexOf('project-browse'));
   picker=async()=>folder;calls.length=0;dialog.chooseFolder(cx);await flush();
   const create=calls.find(c=>c.name==='space.new');assert.ok(create);assert.equal(create.args.argv,undefined);
   assert.equal(create.args.folder,fs.realpathSync(folder));picker=async()=>null;pr={role:'projects'};
 });
 await test('Finder uses the chosen agent without a second open click',async()=>{
   const folder=path.join(temp,'finder-agent');fs.mkdirSync(folder);
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   byId(dialog.render(),'project-agent-codex').events.on_click({},cx);
   picker=async()=>folder;calls.length=0;byId(dialog.render(),'project-browse').events.on_click({},cx);await flush();
   assert.deepEqual(plain(calls.find(c=>c.name==='space.new').args.argv),['codex']);picker=async()=>null;pr={role:'projects'};
 });
 await test('canceling Finder neither opens nor closes the project chooser',async()=>{
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   picker=async()=>null;calls.length=0;dialog.chooseFolder(cx);await flush();
   assert.equal(calls.length,0);assert.equal(dialog.picking,false);pr={role:'projects'};
 });
 await test('a pending Finder selection cannot launch after closing the dialog or open twice',async()=>{
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   let resolve,count=0;picker=()=>{count++;return new Promise(r=>resolve=r);};calls.length=0;
   dialog.chooseFolder(cx);dialog.chooseFolder(cx);assert.equal(count,1);dialog.close();resolve(repo);await flush();
   assert.equal(calls.length,0);picker=async()=>null;pr={role:'projects'};
 });
 await test('default terminal launch does not wait for agent discovery',async()=>{
   const folder=path.join(temp,'finder-before-discovery');fs.mkdirSync(folder);
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   dialog.loading=true;picker=async()=>folder;calls.length=0;dialog.chooseFolder(cx);await flush();
   assert.ok(calls.find(c=>c.name==='space.new'));picker=async()=>null;pr={role:'projects'};
 });
 await test('terminal-only first session is explicit and never inherits agent argv',async()=>{
   const folder=path.join(temp,'terminal-project');fs.mkdirSync(folder);
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();
   dialog.path=folder;dialog.choice='terminal';calls.length=0;dialog.submit(cx);await flush();
   const create=calls.find(c=>c.name==='space.new');assert.ok(create);assert.equal(create.args.argv,undefined);assert.equal(create.args.tab,'Терминал');pr={role:'projects'};
 });
 await test('blank or invalid project paths never inherit the focused folder',async()=>{
   pr={role:'open-project'};const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();calls.length=0;
   dialog.submit(cx);await flush();assert.ok(dialog.error);assert.ok(!calls.some(c=>c.name==='space.new'));
   dialog.path=path.join(temp,'missing');dialog.submit(cx);await flush();assert.ok(dialog.error);assert.ok(!calls.some(c=>c.name==='space.new'));pr={role:'projects'};
 });
 await test('remote selection loads remote agents, clears the local path and hides local folder chooser',async()=>{
   pr={role:'open-project'};machineList.push({name:'server',layout:'ready'});
   const dialog=new openerModule.namespace.default();dialog.init({},cx);await flush();dialog.path='/local/folder';
   dialog.choice='codex';dialog.machine('server',cx);await flush();assert.equal(dialog.choice,'terminal');assert.equal(dialog.path,'');assert.equal(agentHosts.at(-1),'server');
   assert.ok(!byId(dialog.render(),'project-browse'));machineList.pop();pr={role:'projects'};
 });
 await test('PA-Advanced cards offer no pinning and old pins do not reorder a checkout',()=>{
   ag.find(a=>a.address==='a2').pinned=true;tree=owner.render(cx);
   byId(tree,'ag-a1').events.on_hover(true,cx);tree=owner.render(cx);
   assert.equal(nodes(tree).filter(n=>String(n.attrs.id).startsWith('pin-')).length,0);
   assert.ok(!nodes(tree).some(n=>n.type==='svg'&&/pin(-off)?\.svg$/.test(String(n.attrs.path))));
   assert.deepEqual(plain(order),['a1','a2','a3']);ag.find(a=>a.address==='a2').pinned=false;owner.hovered=null;
 });
 await test('Sessions tab lists every agent flat, says its project and keeps navigation in that order',()=>{
   pr={role:'projects'};tree=owner.render(cx);calls.length=0;
   byId(tree,'projects-view-sessions').events.on_click({},cx);assert.equal(state.get('projects.view.v1'),'sessions');
   tree=owner.render(cx);
   assert.ok(!byId(tree,pid));assert.ok(!byId(tree,cid));assert.ok(byId(tree,'ag-a1'));assert.ok(byId(tree,'ag-a2'));
   assert.equal(nodes(tree).filter(n=>n.attrs.id==='sub-a3').length,1);assert.ok(!byId(tree,'ag-shell'));
   assert.ok(text(byId(tree,'ag-a1')).includes('project'));assert.ok(text(byId(tree,'ag-a2')).includes('feature/dashboard'));
   assert.deepEqual(plain(order),['a2','a3','a1']);
   calls.length=0;byId(tree,'ag-a2').events.on_click();assert.deepEqual(plain(calls),[{name:'pane.focus',args:{pane:'p2'}}]);
   assert.ok(byId(tree,'project-new'));
   byId(tree,'projects-view-projects').events.on_click({},cx);assert.equal(state.get('projects.view.v1'),'projects');tree=owner.render(cx);assert.ok(byId(tree,pid));
 });
 await test('dragging a session in Sessions sets a hand order, a click does not, and urgency order can return',()=>{
   state.set('projects.view.v1','sessions');tree=owner.render(cx);assert.deepEqual(plain(order),['a2','a3','a1']);
   const press=(id)=>byId(owner.render(cx),id).events.on_mouse_down();
   press('ag-a1');byId(owner.render(cx),'ag-a1').events.on_mouse_up({},cx);assert.equal(state.get('projects.sessionsManual.v1'),undefined);
   press('ag-a1');byId(owner.render(cx),'ag-a2').events.on_mouse_move({},cx);byId(owner.render(cx),'ag-a2').events.on_mouse_up({},cx);
   assert.equal(state.get('projects.sessionsManual.v1'),true);assert.deepEqual(plain(state.get('projects.sessionOrder.v1').slice(0,2)),['a1','a2']);
   tree=owner.render(cx);assert.deepEqual(plain(order),['a1','a2','a3']);
   assert.ok(!nodes(tree).some(n=>String(n.attrs.id).startsWith('sessions-sec-')));
   byId(tree,'sessions-sort-status').events.on_click({},cx);tree=owner.render(cx);assert.deepEqual(plain(order),['a2','a3','a1']);assert.equal(state.get('projects.sessionsManual.v1'),false);
   byId(tree,'sessions-sort-manual').events.on_click({},cx);tree=owner.render(cx);assert.deepEqual(plain(order),['a1','a2','a3']);
   byId(tree,'sessions-sort-status').events.on_click({},cx);tree=owner.render(cx);
   state.set('projects.view.v1','projects');state.delete('projects.sessionOrder.v1');state.delete('projects.sessionsManual.v1');tree=owner.render(cx);
 });
 await test('Sessions by status shows Workshop sections that fold their cards',()=>{
   state.set('projects.view.v1','sessions');tree=owner.render(cx);
   const secs=nodes(tree).filter(n=>String(n.attrs.id).startsWith('sessions-sec-')).map(n=>n.attrs.id);
   assert.ok(secs.length>=2);assert.equal(new Set(secs).size,secs.length);
   const last=secs.at(-1);assert.ok(text(byId(tree,last)).length>0);
   assert.ok(byId(tree,'ag-a1'));byId(tree,last).events.on_click({},cx);tree=owner.render(cx);
   assert.ok(!byId(tree,'ag-a1'));assert.ok(byId(tree,'ag-a2'));
   byId(tree,last).events.on_click({},cx);tree=owner.render(cx);assert.ok(byId(tree,'ag-a1'));
   state.set('projects.view.v1','projects');tree=owner.render(cx);
 });
 await test('in Projects a session cannot be dragged into another checkout',()=>{
   tree=owner.render(cx);byId(tree,'ag-a1').events.on_mouse_down();byId(owner.render(cx),'ag-a2').events.on_mouse_move({},cx);byId(owner.render(cx),'ag-a2').events.on_mouse_up({},cx);
   assert.equal(state.get('projects.sessionOrder.v1'),undefined);owner.render(cx);assert.deepEqual(plain(order),['a1','a2','a3']);
 });
 await test('dragging a project header reorders projects on its machine and persists',async()=>{
   const plainDir=path.join(temp,'plain');fs.mkdirSync(plainDir);sp.push({id:'plain',name:'plain',machine:null,folder:plainDir,tabs:[]});
   owner.render(cx);await flush();tree=owner.render(cx);
   const heads=()=>nodes(owner.render(cx)).map(n=>String(n.attrs.id)).filter(id=>/^project-\[/.test(id)&&!/-(fold|add)$/.test(id));
   const [first,second]=heads();assert.ok(first&&second);
   byId(owner.render(cx),second).events.on_mouse_down();byId(owner.render(cx),first).events.on_mouse_move({},cx);byId(owner.render(cx),first).events.on_mouse_up({},cx);
   assert.deepEqual(heads().slice(0,2),[second,first]);assert.ok(state.get('projects.order.v1').length>=2);
   sp.pop();state.delete('projects.order.v1');tree=owner.render(cx);
 });
 await test('a press released on a header button is not a drag: hovering another project later moves nothing',async()=>{
   const plainDir=path.join(temp,'plain2');fs.mkdirSync(plainDir);sp.push({id:'plain2',name:'plain2',machine:null,folder:plainDir,tabs:[]});
   owner.render(cx);await flush();tree=owner.render(cx);
   const heads=()=>nodes(owner.render(cx)).map(n=>String(n.attrs.id)).filter(id=>/^project-\[/.test(id)&&!/-(fold|add)$/.test(id));
   const [first,second]=heads();
   byId(owner.render(cx),second).events.on_mouse_down();byId(owner.render(cx),`${second}-fold`).events.on_click({},cx);
   byId(owner.render(cx),first).events.on_mouse_move({},cx);byId(owner.render(cx),first).events.on_mouse_up({},cx);
   assert.deepEqual(heads().slice(0,2),[first,second]);assert.equal(state.get('projects.order.v1'),undefined);
   byId(owner.render(cx),`${second}-fold`).events.on_click({},cx);sp.pop();tree=owner.render(cx);
 });
 await test('only the window-focused session is current; hovering it never changes its look; project rows have no fill',()=>{
   ag.find(a=>a.address==='a2').focused=true;tree=owner.render(cx);
   const a1=byId(tree,'ag-a1'),a2=byId(tree,'ag-a2');
   assert.equal(a1.attrs.bg,'#7777771a');assert.equal(a1.attrs.hover,undefined);
   assert.notEqual(a2.attrs.bg,'#7777771a');assert.equal(typeof a2.attrs.hover,'function');
   assert.notEqual(byId(tree,pid).attrs.bg,'#7777771a');
   // PROJECTS lights the project rail beside the card; SESSIONS keeps the bar on the card.
   const bar=n=>n._children.find(c=>c.attrs.absolute!==undefined&&c.attrs.w!==undefined);
   assert.equal(bar(a1).attrs.left,-5);
   state.set('projects.view.v1','sessions');tree=owner.render(cx);assert.equal(bar(byId(tree,'ag-a1')).attrs.left,0);
   state.set('projects.view.v1','projects');tree=owner.render(cx);ag.find(a=>a.address==='a2').focused=false;
 });
 await test('classic workshop retains its grouping and does not list shell-only sessions',async()=>{
   pr={role:'agents'};state.set('layout','PA-Light');const old=new mod.namespace.Agents();old.init({},cx);await flush();tree=old.render(cx);
   assert.equal(old.projects,undefined);assert.ok(text(tree).includes('МАСТЕРСКАЯ'));assert.ok(!byId(tree,'project-list'));assert.ok(!byId(tree,'ag-shell'));
 });
 console.log(`${n} project tree tests passed`);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
