#!/usr/bin/env python3
"""Portable package checks and regression tests. Native checks are a separate step."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
read = lambda path: path.read_text(encoding='utf-8')
manifest = json.loads(read(ROOT / 'manifest.json'))
for path in ROOT.rglob('*.json'):
    if '.git' not in path.parts:
        json.loads(read(path))
# Both key files bind the same commands in the same sections.
mac_keys, windows_keys = (json.loads(read(ROOT / name)) for name in ('keys.json', 'keys.windows.json'))
assert {s: sorted(set(b.values())) for s, b in mac_keys.items()} == {s: sorted(set(b.values())) for s, b in windows_keys.items()}, 'keys.json and keys.windows.json bind different commands'
canonical = read(ROOT / 'mods/my-files/filesystem.js')
for mod in ('file-tab', 'find', 'prodsovet', 'session_fork'):
    assert read(ROOT / f'mods/{mod}/filesystem.js').split('\n', 1)[1] == canonical, mod + ': shared API copy drifted'
helpers = [read(ROOT / 'mods' / name / 'appearance.js') for name in manifest['mods']]
assert len(set(helpers)) == 1, 'Appearance helper copies drifted'
subprocess.run([sys.executable, '-B', str(ROOT / 'sync_appearance.py'), '--check'], check=True)
for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts or '__pycache__' in path.parts:
        continue
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    assert path.name not in {'shared.json','view.json','settings.json','limits.local.json','auth.json'}, f'Private state: {path}'
    if path.suffix in {'.py','.js','.mjs','.json','.md','.html','.svg'}:
        text = read(path)
        # Herdr and the installer's digests expect LF files (see .gitattributes).
        assert '\r\n' not in text, f'CRLF line endings: {path}'
        # Match actual local user paths, not test fixtures or this scanner's pattern.
        assert not re.search(r'/Users/' + r'daniel(?:/|\b)', text), f'Personal path: {path}'
        assert not re.search(r'(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)', text), f'Credential-shaped data: {path}'
        if path.suffix == '.js':
            for ref in re.findall(r'from [\'"](\.[^\'"]+)[\'"]', text):
                dest = (path.parent / ref).resolve()
                assert path.parent.resolve() in dest.parents and dest.is_file(), f'Invalid import: {path}: {ref}'
print('Package structure, JSON, module copies and privacy scan: PASS', flush=True)
subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], cwd=ROOT, check=True)
for name in ('test_herdr_files.mjs', 'test_herdr_files_windows.mjs', 'test_herdr_files_ui.mjs', 'test_appearance.mjs', 'test_commit_suggestion.mjs', 'test_projects.mjs'):
    subprocess.run(['node','--experimental-vm-modules',str(ROOT/'tests'/name)], cwd=ROOT, check=True)
print('All package checks passed.')
