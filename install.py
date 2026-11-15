#!/usr/bin/env python3
"""Reviewable installer. Dry-run by default; never replace existing mods or keys."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import sys

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'manifest.json').read_text())
RECEIPT = '.herdr-prodsovet-install.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe(home, relative):
    relative = Path(relative)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Unsafe package path')
    dest = home / relative
    if any(p.is_symlink() for p in [dest, *dest.parents]):
        raise ValueError(f'Symlink destination refused: {relative}')
    return dest


def read_keys(home):
    path = safe(home, 'keys.json')
    data = path.read_bytes() if path.exists() else None
    keys = json.loads(data) if data is not None else {}
    if not isinstance(keys, dict) or any(not isinstance(v, dict) for v in keys.values()):
        raise ValueError('keys.json must contain a JSON object of key sections')
    return data, keys


def atomic_json(path, value):
    temp = path.with_name(path.name + '.prodsovet-tmp')
    with temp.open('x') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n')
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def payload():
    files = {}
    for name in MANIFEST['mods']:
        for p in sorted((ROOT / 'mods' / name).rglob('*')):
            if p.is_symlink():
                raise ValueError('Package symlink refused')
            if p.is_file() and p.suffix in {'.js', '.py', '.svg', '.png', '.json'}:
                if p.name in {'limits.local.json', 'jsconfig.json'} or '__pycache__' in p.parts:
                    continue
                files[str(p.relative_to(ROOT))] = p.read_bytes()
    for name in MANIFEST['appearance_files']:
        files[name] = (ROOT / name).read_bytes()
    return files


def install(home, apply=False, skip_conflicts=False, with_limits=False):
    home = Path(home).absolute()
    if safe(home, RECEIPT).exists():
        raise ValueError('Already installed. See README for update instructions.')
    for name in MANIFEST['mods']:
        if safe(home, 'mods/' + name).exists():
            raise ValueError(f'Name collision: mods/{name}. Existing files are preserved.')
    files = payload()
    if with_limits:
        files['mods/prodsovet/limits.local.json'] = b'{"claude": true, "codex": true}\n'
    for name in files:
        if safe(home, name).exists():
            raise ValueError(f'Name collision: {name}')
    original, keys = read_keys(home)
    added = {}
    for section, bindings in json.loads((ROOT / 'keys.json').read_text()).items():
        for key, action in bindings.items():
            old = keys.get(section, {}).get(key)
            if key in keys.get(section, {}) and old != action:
                if not skip_conflicts:
                    raise ValueError(f'Key conflict: {section} / {key}. Use --skip-conflicting-keys to keep it.')
                print(f'KEEP existing binding: {section} / {key}')
                continue
            if key not in keys.get(section, {}):
                keys.setdefault(section, {})[key] = action
                added.setdefault(section, {})[key] = action
    print(f'{"INSTALL" if apply else "PLAN"}: {len(files)} files, {sum(map(len, added.values()))} new bindings -> {home}')
    if not apply:
        return
    made = []
    keys_written = False
    try:
        for name, data in files.items():
            path = safe(home, name)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as f:
                made.append(path)
                f.write(data)
        current, _ = read_keys(home)
        if current != original:
            raise ValueError('keys.json changed during installation; retry after closing Herdr.')
        if added:
            atomic_json(home / 'keys.json', keys)
            keys_written = True
        receipt = {'version': MANIFEST['version'], 'files': {n: digest(d) for n, d in files.items()}, 'added_keys': added, 'keys_existed': original is not None, 'original_sections': list(json.loads(original)) if original else []}
        with safe(home, RECEIPT).open('x') as f:
            json.dump(receipt, f, indent=2)
    except Exception:
        for p in reversed(made):
            p.unlink(missing_ok=True)
        if keys_written:
            if original is None:
                (home / 'keys.json').unlink(missing_ok=True)
            else:
                (home / 'keys.json').write_bytes(original)
        # Only remove now-empty directories created for this package.
        for p in reversed(made):
            parent = p.parent
            while parent != home:
                try: parent.rmdir()
                except OSError: break
                parent = parent.parent
        raise
    print('Installed. Check all five mods, then switch to layout ProdAdvice. Layout was not activated.')


def uninstall(home, apply=False):
    home = Path(home).absolute()
    receipt_path = safe(home, RECEIPT)
    receipt = json.loads(receipt_path.read_text())
    for name, expected in receipt['files'].items():
        p = safe(home, name)
        if p.exists() and digest(p.read_bytes()) != expected:
            raise ValueError(f'Modified file preserved: {name}. Save your edits and resolve before uninstalling.')
    _, keys = read_keys(home)
    for section, bindings in receipt['added_keys'].items():
        for key, value in bindings.items():
            if keys.get(section, {}).get(key) == value:
                del keys[section][key]
        if section in keys and not keys[section] and section not in receipt['original_sections']:
            del keys[section]
    print(f'{"REMOVE" if apply else "PLAN REMOVE"}: package files -> {home}; user state is preserved')
    if not apply:
        return
    if (home / 'keys.json').exists():
        if not keys and not receipt['keys_existed']:
            (home / 'keys.json').unlink()
        else:
            atomic_json(home / 'keys.json', keys)
    parents = set()
    for name in receipt['files']:
        p = safe(home, name)
        p.unlink(missing_ok=True)
        parents.update(p.parents)
    receipt_path.unlink()
    for parent in sorted(parents, key=lambda p: len(p.parts), reverse=True):
        if parent == home or home not in parent.parents:
            continue
        try: parent.rmdir()
        except OSError: pass


def dependencies(home):
    missing = [x for x in ('python3', 'herdr-app', 'hc', 'rg') if not shutil.which(x)]
    if platform.system() != 'Darwin':
        missing.append('macOS (this release is macOS-only)')
    if not Path('/usr/bin/trash').is_file():
        missing.append('/usr/bin/trash')
    for mod in MANIFEST['stock_mods']:
        if not (home / 'mods' / mod / 'main.js').is_file():
            missing.append('Herdr built-in mod: ' + mod)
    if missing:
        raise ValueError('Missing dependencies: ' + ', '.join(missing))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', type=Path, default=Path(os.environ.get('HERDR_APP_HOME', str(Path.home() / '.config/herdr-app'))))
    parser.add_argument('--apply', action='store_true', help='Write changes; default is a dry run')
    parser.add_argument('--uninstall', action='store_true')
    parser.add_argument('--skip-conflicting-keys', action='store_true')
    parser.add_argument('--with-limits', action='store_true', help='Enable Keychain/Anthropic usage and local Codex session reading')
    args = parser.parse_args()
    if args.uninstall:
        uninstall(args.home, args.apply)
    else:
        dependencies(args.home)
        install(args.home, args.apply, args.skip_conflicting_keys, args.with_limits)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f'Not completed: {error}', file=sys.stderr)
        sys.exit(1)
