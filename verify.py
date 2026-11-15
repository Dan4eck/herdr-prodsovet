#!/usr/bin/env python3
"""Portable package checks and regression tests. Native checks are a separate step."""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'manifest.json').read_text())
for path in ROOT.rglob('*.json'):
    if '.git' not in path.parts:
        json.loads(path.read_text())
canonical = (ROOT / 'mods/my-files/filesystem.js').read_text()
for mod in ('file-tab', 'find', 'prodsovet'):
    assert (ROOT / f'mods/{mod}/filesystem.js').read_text().split('\n', 1)[1] == canonical, mod + ': shared API copy drifted'
helpers = [(ROOT / 'mods' / name / 'appearance.js').read_text() for name in manifest['mods']]
assert len(set(helpers)) == 1, 'Appearance helper copies drifted'
subprocess.run([sys.executable, '-B', str(ROOT / 'sync_appearance.py'), '--check'], check=True)
for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts or '__pycache__' in path.parts:
        continue
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    assert path.name not in {'shared.json','view.json','settings.json','limits.local.json','auth.json'}, f'Private state: {path}'
    if path.suffix in {'.py','.js','.mjs','.json','.md','.html','.svg'}:
        text = path.read_text()
        # Match actual local user paths, not test fixtures or this scanner's pattern.
        assert not re.search(r'/Users/' + r'daniel(?:/|\b)', text), f'Personal path: {path}'
        assert not re.search(r'(?:gh[pousr]_[A-Za-z0-9]{30,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)', text), f'Credential-shaped data: {path}'
        if path.suffix == '.js':
            for ref in re.findall(r'from [\'"](\.[^\'"]+)[\'"]', text):
                dest = (path.parent / ref).resolve()
                assert path.parent.resolve() in dest.parents and dest.is_file(), f'Invalid import: {path}: {ref}'
print('Package structure, JSON, module copies and privacy scan: PASS', flush=True)
subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], cwd=ROOT, check=True)
for name in ('test_herdr_files.mjs', 'test_herdr_files_ui.mjs', 'test_appearance.mjs'):
    subprocess.run(['node','--experimental-vm-modules',str(ROOT/'tests'/name)], cwd=ROOT, check=True)
print('All package checks passed.')
