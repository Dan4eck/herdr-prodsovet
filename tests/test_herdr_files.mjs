import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const state = new Map(), calls = [];
let spaces = [], panes = [], focus = null, pending = null;
const host = {
  spaces: () => spaces, panes: () => panes, focused: () => focus,
  home: () => '/Users/test', shared: k => state.get(k), setShared: (k,v) => state.set(k,v),
  appHome: () => '/app', window: () => ({platform:'macos'}),
  run: (name,args) => calls.push({name,args}), openOverlay: value => calls.push(value),
  exec: async (_cmd,args) => {
    const request = JSON.parse(args[1]);
    if (pending) await pending;
    return {code:0,stdout:JSON.stringify({old:request.path,path:request.action==='trash'?'/trash/item':request.path.replace(/[^/]+$/,request.name),kind:request.action==='trash'?'trash':'move'})};
  },
};
const context = vm.createContext({console,Date,JSON,Set,Map,Error,Object,String});
const shim = new vm.SyntheticModule(Object.keys(host), function() { for (const [k,v] of Object.entries(host)) this.setExport(k,v); }, {context});
const module = new vm.SourceTextModule(fs.readFileSync(new URL('../mods/my-files/filesystem.js',import.meta.url),'utf8'), {context});
await module.link(() => shim); await module.evaluate(); const api = module.namespace;
let n = 0;
async function test(name, fn) { await fn(); console.log(`ok ${++n} - ${name}`); }
function reset() {state.clear(); calls.length=0; pending=null;
  spaces=[{id:'pa',folder:'/Users/test',active:true,machine:null,tabs:[{id:'agent'},{id:'file'},{id:'wrong'}]}, {id:'cms',folder:'/Users/test',active:false,machine:null,tabs:[{id:'cms-agent'}]}];
  panes=[{tab:'agent',terminal:'t1',cwd:'/projects/pa'},{tab:'wrong',terminal:'t2',cwd:'/Users/test'},{tab:'cms-agent',terminal:'t3',cwd:'/projects/cms'},{tab:'file',mod:'file-tab',cwd:null}];
  focus={space:'pa',tab:'file',terminal:null,cwd:null};
}
reset();
await test('file tab resolves the workspace project despite saved HOME',()=>assert.equal(api.workspace().cwd,'/projects/pa'));
await test('new terminal from file tab has explicit project and space',()=>{api.newTerminal();assert.equal(calls.at(-1).args.folder,'/projects/pa');assert.equal(calls.at(-1).args.space,'pa');});
await test('selecting an old HOME terminal never changes the pinned root',()=>{focus={space:'pa',tab:'wrong',cwd:'/Users/test',terminal:'t2'};assert.equal(api.workspace().cwd,'/projects/pa');api.newTerminal('right');assert.equal(calls.at(-1).args.folder,'/projects/pa');});
await test('manual browsing does not change new terminal root',()=>{api.browse('/elsewhere','pa');assert.equal(api.location().cwd,'/elsewhere');api.newTerminal();assert.equal(calls.at(-1).args.folder,'/projects/pa');});
await test('spaces remember independent browser roots',()=>{spaces[0].active=false;spaces[1].active=true;assert.equal(api.location().cwd,'/projects/cms');spaces[0].active=true;spaces[1].active=false;assert.equal(api.location().cwd,'/elsewhere');});
await test('configured root is retained when terminal is in its subfolder',()=>{reset();spaces[0].folder='/projects/pa';panes[0].cwd='/projects/pa/src';assert.equal(api.workspace().cwd,'/projects/pa');});
await test('remote roots keep their own machine',()=>{reset();spaces[0].machine='vps';panes[0].cwd='/srv/app';assert.equal(api.workspace().on,'vps');assert.equal(api.workspace().cwd,'/srv/app');});
await test('an open file on another machine or space is not selected',()=>{reset();state.set('files.documents',{file:{file:'/projects/pa/a.md',on:'vps',space:'pa'}});api.openFile('/projects/pa/a.md');assert.equal(calls.at(-1).name,'tab.new');});
await test('same file in the same space selects its existing tab',()=>{reset();state.set('files.documents',{file:{file:'/projects/pa/a.md',on:null,space:'pa'}});api.openFile('/projects/pa/a.md');assert.equal(calls.at(-1).name,'tab.select');assert.equal(calls.at(-1).args.id,'file');});
await test('dirty descendants block rename and deletion',async()=>{reset();state.set('files.documents',{file:{file:'/projects/pa/folder/a.md',on:null,space:'pa',dirty:true}});await assert.rejects(api.operation({path:'/projects/pa/folder',action:'trash'}),/Сначала сохраните/);});
await test('moving parent updates every open descendant tab',async()=>{reset();state.set('files.documents',{file:{file:'/projects/pa/folder/a.md',on:null,space:'pa',dirty:false}});await api.operation({path:'/projects/pa/folder',action:'rename'},'renamed');assert.equal(state.get('files.documents').file.file,'/projects/pa/renamed/a.md');assert.equal(state.get('files.operation'),null);});
await test('trash marks an open file missing without closing its tab',async()=>{reset();state.set('files.documents',{file:{file:'/projects/pa/a.md',on:null,space:'pa',dirty:false}});await api.operation({path:'/projects/pa/a.md',action:'trash'});assert.equal(state.get('files.documents').file.removed,true);assert.ok(!calls.some(c=>c.name==='tab.close'));});
await test('in-flight move locks editor saving and rejects concurrent operations',async()=>{reset();let done;pending=new Promise(r=>done=r);const moving=api.operation({path:'/projects/pa/a.md',action:'rename'},'b.md');assert.equal(api.isLocked('/projects/pa/a.md'),true);await assert.rejects(api.operation({path:'/projects/pa/b.md',action:'trash'}),/Дождитесь/);done();await moving;assert.equal(api.isLocked('/projects/pa/a.md'),false);});
console.log(`${n} state tests passed`);
