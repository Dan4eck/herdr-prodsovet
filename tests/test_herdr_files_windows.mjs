// The shared filesystem API on Windows: paths, Python, clipboard, Explorer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const state = new Map(), calls = [], execs = [];
let onRun = null, spaces = [], panes = [], platform = 'windows', answer = () => ({ code: 0, stdout: '{}', stderr: '' });
const host = {
  spaces: () => spaces, panes: () => panes, focused: () => null,
  home: () => 'C:\\Users\\test', shared: k => state.get(k), setShared: (k, v) => state.set(k, v),
  appHome: () => 'C:\\Users\\test/.config/herdr-app', window: () => ({ platform }), settings: () => ({ dark: true }),
  run: (name, args) => { calls.push({ name, args }); onRun?.(name); }, openOverlay: value => calls.push(value),
  exec: async (cmd, args, options) => { execs.push({ cmd, args, options }); return answer(cmd, args, options); },
};
const context = vm.createContext({ console, Date, JSON, Set, Map, Error, Object, String });
const shim = new vm.SyntheticModule(Object.keys(host), function () { for (const [k, v] of Object.entries(host)) this.setExport(k, v); }, { context });
const module = new vm.SourceTextModule(fs.readFileSync(new URL('../mods/my-files/filesystem.js', import.meta.url), 'utf8'), { context });
const strings = new vm.SyntheticModule(['L', 'style'], function () { this.setExport('L', (en) => en); this.setExport('style', () => false); }, { context });
await module.link(spec => spec === './appearance.js' ? strings : shim); await module.evaluate();
const api = module.namespace;
let n = 0;
async function test(name, fn) { await fn(); console.log(`ok ${++n} - ${name}`); }
const python = () => execs.filter(e => e.cmd === 'py');

await test('Windows paths: basename, parent and join keep native separators', () => {
  assert.equal(api.basename('C:\\Users\\test\\proj\\a.md'), 'a.md');
  assert.equal(api.basename('C:/Users/test/proj/'), 'proj');
  assert.equal(api.basename('C:\\'), 'C:\\');
  assert.equal(api.parent('C:\\Users\\test\\proj'), 'C:\\Users\\test');
  assert.equal(api.parent('C:\\Users'), 'C:\\');
  assert.equal(api.parent('C:\\'), 'C:\\');
  assert.equal(api.parent('\\\\server\\share\\dir'), '\\\\server\\share\\');
  assert.equal(api.join('C:\\Users\\test\\proj', 'src/lib/a.js'), 'C:\\Users\\test\\proj\\src\\lib\\a.js');
  assert.equal(api.join('C:\\', 'x'), 'C:\\x');
  assert.equal(api.native('c:/Users//test/'), 'C:\\Users\\test');
});
await test('Windows paths compare without case or separator differences', () => {
  assert.ok(api.within('C:\\Users\\Test\\Proj\\src', 'c:/users/test/proj'));
  assert.ok(api.within('C:\\x', 'C:\\'));
  assert.ok(!api.within('C:\\Users\\testing', 'C:\\Users\\test'));
  assert.ok(!api.within('D:\\Users\\test', 'C:\\Users\\test'));
  assert.ok(api.samePath('C:\\Users\\test', 'c:/users/test/'));
  assert.ok(api.isAbsolute('C:\\x') && api.isAbsolute('/srv/x') && !api.isAbsolute('src\\x'));
});
await test('Unix paths behave exactly as before', () => {
  assert.equal(api.basename('/srv/app/'), 'app');
  assert.equal(api.parent('/srv/app'), '/srv');
  assert.equal(api.parent('/srv'), '/');
  assert.equal(api.join('/', 'x'), '/x');
  assert.equal(api.join('/srv', 'a/b'), '/srv/a/b');
  assert.ok(api.within('/srv/app/x', '/srv/app') && !api.within('/srv/apps', '/srv/app'));
});
await test('home is shown as ~ in labels', () => {
  assert.equal(api.tilde('C:\\Users\\test'), '~');
  assert.equal(api.tilde('c:/users/test/proj'), '~\\proj');
  assert.equal(api.tilde('D:\\work'), 'D:\\work');
});
await test('workspace root ignores a HOME terminal written with other case', () => {
  spaces = [{ id: 'pa', folder: 'C:\\Users\\test', active: true, machine: null, tabs: [{ id: 'a' }, { id: 'b' }] }];
  panes = [{ tab: 'a', terminal: 't1', cwd: 'c:\\users\\TEST' }, { tab: 'b', terminal: 't2', cwd: 'C:\\work\\pa' }];
  assert.equal(api.workspace().cwd, 'C:\\work\\pa');
  assert.equal(api.spaceLabel(spaces[0]), 'pa');
});
await test('Python: the py launcher in UTF-8 mode, probed once', async () => {
  execs.length = 0;
  answer = (cmd, args) => args.includes('-c') ? { code: 0, stdout: '3\r\n', stderr: '' } : { code: 0, stdout: '{"path":"C:\\\\x"}', stderr: '' };
  await api.localOperation({ action: 'directory', path: 'C:\\x' });
  await api.localOperation({ action: 'directory', path: 'C:\\y' });
  assert.equal(python().filter(e => e.args.includes('-c')).length, 1);
  const run = python().at(-1);
  assert.deepEqual([...run.args.slice(0, 3)], ['-3', '-X', 'utf8']);
  assert.ok(run.args[3].endsWith('/mods/my-files/file-ops.py'));
});
await test('macOS and other machines keep python3', async () => {
  execs.length = 0;
  await api.python(['-c', 'x'], { on: 'vps' });
  assert.equal(execs.at(-1).cmd, 'python3');
  platform = 'macos';
  await api.python(['x']);
  assert.equal(execs.at(-1).cmd, 'python3');
  platform = 'windows';
});
await test('pasting into an agent: save clipboard, paste, restore it later', async () => {
  execs.length = 0; calls.length = 0;
  answer = (cmd, args) => {
    const request = JSON.parse(args.at(-1));
    return { code: 0, stdout: JSON.stringify(request.action === 'clipboard-get' ? { text: 'mine' } : {}), stderr: '' };
  };
  await api.pasteInto('t7', '@C:\\proj\\a.md ');
  const actions = python().map(e => JSON.parse(e.args.at(-1)));
  assert.deepEqual(actions.map(a => a.action), ['clipboard-get', 'clipboard-set', 'clipboard-set']);
  assert.equal(actions[1].text, '@C:\\proj\\a.md ');
  assert.deepEqual([actions[2].text, actions[2].delay], ['mine', 0.7]);
  assert.deepEqual(calls.map(c => c.name), ['pane.focus', 'terminal.paste']);
  assert.ok(python()[0].args.at(-2).endsWith('/mods/my-files/system.py'));
});
await test('a popup closes only once the clipboard is ready, then paste and restore start at once', async () => {
  execs.length = 0; calls.length = 0;
  const order = [];
  answer = (cmd, args) => {
    const request = JSON.parse(args.at(-1));
    order.push(request.action + (request.delay ? '-later' : ''));
    return { code: 0, stdout: JSON.stringify(request.action === 'clipboard-get' ? { text: 'mine' } : {}), stderr: '' };
  };
  onRun = (name) => order.push(name);
  let restoreStarted;
  await api.pasteInto('t7', 'x', () => { order.push('close'); });
  restoreStarted = order.includes('clipboard-set-later');  // started before any await after close
  onRun = null;
  assert.deepEqual(order, ['clipboard-get', 'clipboard-set', 'close', 'pane.focus', 'terminal.paste', 'clipboard-set-later']);
  assert.ok(restoreStarted);
});
await test('reveal and open go through system.py; errors surface', async () => {
  execs.length = 0;
  answer = () => ({ code: 0, stdout: '{}', stderr: '' });
  await api.reveal('C:\\proj\\a.md');
  await api.openExternal('https://github.com/x/y/pull/1');
  assert.deepEqual(python().map(e => JSON.parse(e.args.at(-1)).action), ['reveal', 'open']);
  answer = () => ({ code: 1, stdout: '{"error":"Файл не найден"}', stderr: '' });
  await assert.rejects(api.reveal('C:\\nope'), /Файл не найден/);
  assert.equal(api.revealLabel(), 'Show in Explorer');
  assert.equal(api.thisComputer(), 'THIS PC');
});
await test('file operations run on Windows and refresh open documents', async () => {
  state.clear(); execs.length = 0;
  panes = [{ tab: 'doc', mod: 'file-tab' }];
  state.set('files.documents', { doc: { file: 'C:\\proj\\notes\\a.md', on: null, space: 'pa' } });
  answer = (cmd, args) => {
    if (args.includes('-c')) return { code: 0, stdout: '3', stderr: '' };
    const request = JSON.parse(args.at(-1));
    return { code: 0, stdout: JSON.stringify({ old: request.path, path: 'C:\\proj\\docs', kind: 'move' }), stderr: '' };
  };
  await api.operation({ action: 'rename', path: 'C:\\proj\\notes' }, 'docs');
  assert.equal(state.get('files.documents').doc.file, 'C:\\proj\\docs\\a.md');
  await assert.rejects(api.operation({ action: 'rename', path: '/srv/x', on: 'vps' }, 'y'), /only on this computer/);
});
await test('without Python 3 the error says what to install', async () => {
  // A fresh module: the found interpreter is cached per mod copy.
  const fresh = new vm.SourceTextModule(fs.readFileSync(new URL('../mods/my-files/filesystem.js', import.meta.url), 'utf8'), { context });
  await fresh.link(spec => spec === './appearance.js' ? strings : shim); await fresh.evaluate();
  answer = (cmd) => { if (cmd === 'py') throw new Error('cannot run py: program not found'); return { code: 9009, stdout: '', stderr: 'Python was not found' }; };
  await assert.rejects(fresh.namespace.python(['x']), /Python 3 is required/);
});
