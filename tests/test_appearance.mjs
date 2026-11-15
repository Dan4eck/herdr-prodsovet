import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
let active='ProdAdvice';
const context=vm.createContext({JSON,Object,Number,Error});
const modules=new Map();
let dark=true;
const host=new vm.SyntheticModule(['shared','settings'],function(){this.setExport('shared',key=>key==='layout'?active:undefined);this.setExport('settings',()=>({dark}))},{context});
async function load(file){
 if(modules.has(file))return modules.get(file);
 const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});modules.set(file,mod);
 await mod.link((s,ref)=>s==='herdr'?host:load(path.resolve(path.dirname(ref.identifier),s)));return mod;
}
const helper=await load(path.join(root,'mods/prodsovet/appearance.js'));await helper.evaluate();
const a=helper.namespace;
const palette=await load(path.join(root,'mods/prodsovet/palette.js'));await palette.evaluate();
const p=palette.namespace;
let count=0;
function test(name,fn){fn();console.log(`ok ${++count} - ${name}`);}
test('unknown layouts keep compatible defaults',()=>{active='main';assert.equal(a.profileName(),'ProdAdvice');assert.equal(a.fontSize('files.body'),13);});
test('profiles own independent typography and palette objects',()=>{
 const x=JSON.parse(JSON.stringify(a.appearance('ProdAdvice'))),y=JSON.parse(JSON.stringify(a.appearance('ProdAdvice2')));
 assert.equal(x.lightTheme,'ProdAdvice-light');assert.equal(y.lightTheme,'ProdAdvice2-light');
 assert.equal(x.lightPalette.background,'#f7f9f4');assert.notEqual(y.lightPalette.background,x.lightPalette.background);
 assert.notEqual(a.appearance('ProdAdvice').text,a.appearance('ProdAdvice2').text);
});
test('classic profile without a style block keeps the original drawing style',()=>{
 active='ProdAdvice';assert.equal(a.appearance().style,undefined);
 assert.equal(a.radius(7),7);assert.equal(a.labelFont(),null);assert.equal(a.brandFont(),a.appearance().fonts.ui);
 assert.equal(a.style('brandChip'),false);assert.equal(a.style('selectionBar'),false);
});
test('agent accents follow the profile and the light/dark mode',()=>{
 active='ProdAdvice';assert.equal(a.agentAccent('claude'),null);assert.equal(a.style('agency'),false);
 active='ProdAdvice2';const own=a.appearance().style.agentAccents;
 dark=true;assert.equal(a.agentAccent('claude'),own.claude.dark);assert.equal(a.agentAccent('unknown-kind'),own.other.dark);
 dark=false;assert.equal(a.agentAccent('codex'),own.codex.light);dark=true;
});
test('second profile owns its drawing style without touching classic',()=>{
 active='ProdAdvice2';const own=a.appearance().style;
 assert.equal(a.radius(7),7*own.radiusScale);assert.equal(a.labelFont(),own.labelFont==='mono'?a.appearance().fonts.mono:null);
 own.radiusScale=0.5;assert.equal(a.radius(8),4);
 active='ProdAdvice';assert.equal(a.radius(8),8);
 assert.throws(()=>a.style('missing'),/Unknown appearance style/);
});
test('changing the second profile does not change classic typography or colors',()=>{
 const second=a.appearance('ProdAdvice2');second.text.files.body=17;second.brandColors.dark='#123456';
 active='ProdAdvice2';assert.equal(a.fontSize('files.body'),17);assert.equal(a.appearance().brandColors.dark,'#123456');
 active='ProdAdvice';assert.equal(a.fontSize('files.body'),13);assert.equal(a.appearance().brandColors.dark,'#7d9a72');
});
test('changing classic does not change second typography',()=>{
 active='ProdAdvice2';const own=a.fontSize('files.meta');
 a.appearance('ProdAdvice').text.files.meta=22;assert.equal(a.fontSize('files.meta'),own);assert.notEqual(own,22);
});
test('agent tint uses the active profile and respects an overriding theme',()=>{
 active='ProdAdvice2';a.appearance().agentPalettes.codex.background='#123456';
 assert.equal(p.paletteFor({app:'codex'}).background,'#123456');
 assert.equal(p.enabled({theme:{dark:'ProdAdvice2'}},true),true);
 assert.equal(p.enabled({theme:{dark:'graphite'}},true),false);
 active='ProdAdvice';assert.equal(p.paletteFor({app:'codex'}).background,'#090b0e');
});
test('disabling second-profile tints leaves classic enabled',()=>{
 active='ProdAdvice2';a.appearance().agentTints=false;assert.equal(p.enabled({theme:'ProdAdvice2'},true),false);
 active='ProdAdvice';assert.equal(p.enabled({theme:'ProdAdvice'},true),true);
});
test('switching back removes the other profile tint without changing geometry',()=>{
 const tree={id:'root',theme:'ProdAdvice',children:[{id:'main',content:{pane:{background:'#123456',radius:10,header:{height:30}}}}]};
 active='ProdAdvice';const result=p.styledLayout(tree,{app:'codex',status:'working'},true);
 assert.equal(result.children[0].content.pane.background,'#090b0e');assert.equal(result.children[0].content.pane.radius,10);
 assert.equal(result.children[0].content.pane.header.height,30);assert.equal(tree.children[0].content.pane.background,'#123456');
});
test('missing typography values fail visibly instead of borrowing another profile',()=>{assert.throws(()=>a.fontSize('missing.value'),/Unknown appearance/);});
test('light mode releases a dark agent background and transparent terminal',()=>{
 active='ProdAdvice';const tree={id:'root',theme:{dark:'ProdAdvice',light:'ProdAdvice-light'},terminal_opacity:0,children:[{id:'main',content:{pane:{background:'#090b0e',radius:10}}}]};
 const next=p.styledLayout(tree,{app:'codex',status:'working'},false);
 assert.equal(next.children[0].content.pane.background,'background');assert.equal(next.terminal_opacity,undefined);
 assert.equal(p.enabled(tree,false),false);assert.equal(next.children[0].content.pane.radius,10);
});
console.log(`${count} appearance tests passed`);
