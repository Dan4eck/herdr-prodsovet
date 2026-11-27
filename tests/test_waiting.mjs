// Agents at a start-up question: what waitingKind() recognizes on a terminal screen.
import assert from 'node:assert/strict';
import { waitingKind } from '../mods/prodsovet/waiting.js';

let n = 0;
const test = (name, fn) => { fn(); console.log(`ok ${++n} - ${name}`); };

const codexTrust = `
  Folder access
  C:\\Users\\me\\Documents\\ANN
  Trust this folder? Codex can read, edit, and run files here, subject to your permission settings.
› 1. Trust and continue
  2. Back to Agent Command Center
  enter continue · esc back
`;
const claudeFullscreen = `
  · Mouse support: click to move your cursor or expand results
  · Selected text auto-copies to your clipboard
  ❯ 1. Yes, try it
    2. Not now
  Enter to confirm · Esc to cancel
`;

test('a Codex trust question, seen as node.exe', () => {
  assert.equal(waitingKind(codexTrust, 'node'), 'codex');
});
test('a Claude Code question', () => {
  assert.equal(waitingKind(claudeFullscreen + '\n  Claude Code v2.1', 'program'), 'claude');
  assert.equal(waitingKind(claudeFullscreen, 'claude'), 'claude');
  assert.equal(waitingKind(claudeFullscreen, 'program'), 'other');
});
test('a plain prompt or a finished program is not waiting', () => {
  assert.equal(waitingKind('PS C:\\Users\\me> ', 'powershell'), null);
  assert.equal(waitingKind(codexTrust + '\nError: channel closed\nPS C:\\Users\\me\\ANN>', 'powershell'), null);
  assert.equal(waitingKind('dev@vps:~/app$ ls\nREADME.md\ndev@vps:~/app$ ', 'bash'), null);
  assert.equal(waitingKind('', 'node'), null);
});
test('yes/no prompts of other programs', () => {
  assert.equal(waitingKind('Overwrite file? [Y/n]', 'npm'), 'other');
  assert.equal(waitingKind('Continue (y/n)', 'hermes'), 'hermes');
});
test('only the bottom of the screen counts', () => {
  const old = codexTrust + '\n' + Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
  assert.equal(waitingKind(old, 'node'), null);
});
console.log(`${n} waiting tests passed`);
