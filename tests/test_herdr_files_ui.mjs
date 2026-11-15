import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const app=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,''), root=fs.mkdtempSync(path.join(os.tmpdir(),'herdr-files-ui-test-'));
const shared=new Map(), storage=new Map(), calls=[];
let props={}, focus={space:'test',tab:'terminal',terminal:'t1'}, space={id:'test',active:true,folder:root,machine:null,tabs:[{id:'terminal',name:'Terminal'},{id:'file',name:'sample.md'}]};
const extraSpaces=[];
const allPanes=[{tab:'terminal',terminal:'t1',cwd:root},{tab:'file',mod:'file-tab',cwd:null}];
const input=({value='' }={})=>({text:value, value(){return this.text},set_value(v){this.text=v},on(){},focus(){},release(){},set_selected_range(){}});
const element=()=>new Proxy({}, {get:(_,key)=>key==='then'?undefined:(...args)=>key==='when'?(args[0]?args[1](element()):element()):element()});
const theme=()=>({background:'#111111',selection:'#222222',foreground:'#eeeeee',hover:'#333333'});
const host={
  spaces:()=>[space,...extraSpaces],panes:()=>allPanes,focused:()=>focus,home:()=>os.homedir(),
  shared:k=>shared.get(k),setShared:(k,v)=>shared.set(k,v),props:()=>props,theme,settings:()=>({font_family:'mono'}),
  run:(name,args)=>calls.push({name,args}),openOverlay:p=>calls.push({overlay:p}),closeOverlay:id=>calls.push({close:id}),notify:n=>calls.push({notify:n}),
  appHome:()=>app,window:()=>({platform:'macos'}),nextCommand:()=>new Promise(()=>{}),
  readTextFile:async p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):null,
  writeTextFile:async(p,text,expected)=>{assert.equal(fs.existsSync(p)?fs.readFileSync(p,'utf8'):null,expected);fs.writeFileSync(p,text)},
  exec:async(command,args)=>{const r=spawnSync(command,args,{encoding:'utf8'});return {code:r.status,stdout:r.stdout??'',stderr:r.stderr??''}},
};
const ctx=vm.createContext({console,Date,JSON,Object,String,Number,Set,Map,Error,Boolean,Math,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
const cache=new Map();
function synthetic(name,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context:ctx,identifier:name});cache.set(name,m);return m;}
synthetic('herdr',host);
synthetic('gpui-kit',{View:class {},div:element,svg:element,image:element});
synthetic('gpui-base',{v_flex:element,h_flex:element,InputState:{new:input},Input:{new:element},EditorState:{new:input},Editor:{new:element},TextView:{markdown:element},set_theme(){}});
async function load(name){if(cache.has(name))return cache.get(name);const m=new vm.SourceTextModule(fs.readFileSync(name,'utf8'),{context:ctx,identifier:name});cache.set(name,m);await m.link((specifier,ref)=>load(specifier.startsWith('.')?path.resolve(path.dirname(ref.identifier),specifier):specifier));return m;}
const ui=await load(app+'/mods/my-files/dialogs.js');await ui.evaluate();
const ft=await load(app+'/mods/file-tab/main.js');await ft.evaluate();
const api=(await load(app+'/mods/my-files/filesystem.js')).namespace;
const newCx=()=>({theme:()=>({appearance:"dark",colors:{accent:"#000000"},spacing:{},radius:{}}),tasks:[],focus_handle:()=>({focus(){}}),notify(){},stop_propagation(){},timer:{after(){},every(){}},spawn(fn){const p=fn(this);this.tasks.push(p);return p;}});
let n=0;
async function test(name,fn){await fn();console.log(`ok ${++n} - ${name}`)}
async function dialog(action,file,dir,name){props={overlay:'dialog',target:{action,path:file,dir,on:null,space:'test'}};const cx=newCx(), d=new ui.namespace.FileDialog();d.init({},cx);if(name!==undefined)d.input.set_value(name);d.submit(cx);await Promise.all(cx.tasks);d.render(cx);return d;}
try {
  await test('create-file dialog creates file and opens it in the originating space',async()=>{const d=await dialog('create-file',root,true,'sample.md');assert.ok(!d.error);assert.ok(fs.existsSync(root+'/sample.md'));const call=calls.find(c=>c.name==='tab.new');assert.equal(call.args.space,'test');assert.equal(call.args.folder,root)});
  await test('name collision stays in dialog without touching original',async()=>{fs.writeFileSync(root+'/sample.md','keep');calls.length=0;const d=await dialog('create-file',root,true,'sample.md');assert.match(d.error,/существует/);assert.equal(fs.readFileSync(root+'/sample.md','utf8'),'keep');assert.ok(!calls.some(c=>c.close));});
  await test('folder creation dialog creates the destination',async()=>{const d=await dialog('create-folder',root,true,'folder');assert.ok(!d.error);assert.ok(fs.statSync(root+'/folder').isDirectory());});
  let editor;
  await test('legacy file tab reload ignores remembered terminal id',async()=>{props={file:root+'/sample.md',on:null};storage.set('tab','terminal');shared.set('file-tab.open',{[props.file]:'terminal'});const cx=newCx();editor=new ft.namespace.default();editor.init({},cx);await cx.tasks[0];assert.equal(editor.tab,'file');assert.equal(editor.space,'test');assert.equal(editor.code.value(),'keep');});
  await test('dirty editor blocks rename and keeps unsaved text',async()=>{editor.code.set_value('unsaved');editor.snapshot();const d=await dialog('rename',root+'/sample.md',false,'renamed.md');assert.match(d.error,/Сначала сохраните/);assert.ok(fs.existsSync(root+'/sample.md'));assert.equal(editor.code.value(),'unsaved');});
  await test('saving then renaming updates the existing editor path',async()=>{await editor.save(newCx());const d=await dialog('rename',root+'/sample.md',false,'renamed.md');assert.ok(!d.error);editor.syncDocument();assert.equal(editor.file,root+'/renamed.md');editor.code.set_value('after rename');await editor.save(newCx());assert.equal(fs.readFileSync(root+'/renamed.md','utf8'),'after rename');assert.ok(!fs.existsSync(root+'/sample.md'));});
  await test('cut/paste moves file and updates open document',async()=>{api.clipboard({path:root+'/renamed.md',on:null},true);const d=await dialog('paste',root+'/folder',true,'moved.md');assert.ok(!d.error);editor.syncDocument();assert.equal(editor.file,root+'/folder/moved.md');assert.equal(shared.get('files.clipboard'),null);});
  await test('duplicate dialog preserves original',async()=>{const d=await dialog('duplicate',root+'/folder/moved.md',false);assert.ok(!d.error);assert.equal(fs.readFileSync(root+'/folder/moved copy.md','utf8'),'after rename');});
  await test('goto changes browsing without changing workspace launch directory',async()=>{const d=await dialog('goto',root,true,root+'/folder');assert.ok(!d.error);assert.equal(api.location().cwd,root+'/folder');assert.equal(api.workspace().cwd,root);});
  await test('context menu for a file contains all requested operations',()=>{props={target:{path:root+'/folder/moved.md',dir:false,on:null,space:'test'}};const menu=new ui.namespace.FileMenu();menu.init({},newCx());const actions=menu.items().map(x=>x[1]);for(const action of ['create-file','create-folder','rename','duplicate','copy','cut','copy-path','reveal','trash'])assert.ok(actions.includes(action));for(const action of ['goto','workspace'])assert.ok(!actions.includes(action));menu.render(newCx());});
  await test('unsaved buffer survives a mod reload and detects disk conflicts',async()=>{editor.code.set_value('draft recovery');editor.snapshot();fs.writeFileSync(editor.file,'external edit');props={file:root+'/sample.md',on:null};const cx=newCx(), reloaded=new ft.namespace.default();reloaded.init({},cx);await cx.tasks[0];assert.equal(reloaded.code.value(),'draft recovery');await reloaded.save(cx);assert.equal(fs.readFileSync(editor.file,'utf8'),'external edit');assert.ok(reloaded.saveError);});
  await test('same file opened in another space receives its own tab identity',async()=>{storage.clear();extraSpaces.push({id:'other',tabs:[{id:'other-file',name:'moved.md'}]});space.tabs.push({id:'new-file',name:'moved.md'});allPanes.push({tab:'other-file',mod:'file-tab'},{tab:'new-file',mod:'file-tab'});shared.set('file-tab.open',{[root+'/folder/moved.md']:'other-file'});focus={space:'test',tab:'new-file'};props={file:root+'/folder/moved.md',space:'test',on:null};const cx=newCx(), separate=new ft.namespace.default();separate.init({},cx);await cx.tasks[0];assert.equal(separate.tab,'new-file');assert.equal(separate.space,'test');});
  await test('hot reload retains unsaved recovery state',async()=>{editor.syncDocument();editor.code.set_value('close recovery');await editor.close();assert.equal(JSON.parse(storage.get('draft')).text,'close recovery');});
  await test('closing a tab removes its document registration',async()=>{const index=allPanes.findIndex(p=>p.tab===editor.tab);allPanes.splice(index,1);await editor.close();assert.ok(!shared.get('files.documents')[editor.tab]);});
  console.log(`${n} dialog/editor integration tests passed`);
} finally {fs.rmSync(root,{recursive:true,force:true});}
