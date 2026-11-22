#!/usr/bin/env python3
"""Reviewable installer. Dry-run by default; never replace existing mods or keys.

An update replaces only files this installer wrote and nobody changed since."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import sys

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
WINDOWS = sys.platform == 'win32'
# Herdr's own defaults use Cmd on macOS and Ctrl / Ctrl+Shift on Windows; the
# package follows them with one key file per platform.
PACKAGE_KEYS = ROOT / ('keys.windows.json' if WINDOWS else 'keys.json')
RECEIPT = '.herdr-prodsovet-install.json'
# Settings the person owns once written: kept as they are on update.
PERSONAL = {'mods/prodsovet/limits.local.json'}

def live(name):
    """A layout file: Herdr itself writes window state into it (panel sizes,
    the open side panel, pane colors), so a change there is not an edit."""
    return name.startswith('layouts/') and name.endswith('.json')


# Made at run time by file-tab from installed apps; removed on uninstall.
GENERATED = 'mods/file-tab/app-icons'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe(home, relative):
    relative = Path(relative)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Unsafe package path')
    # Only links inside the Herdr home are refused; the home itself is resolved
    # first, so a home under a linked folder (/var -> /private/var) works.
    dest, part = home / relative, home
    for name in relative.parts:
        part = part / name
        if part.is_symlink():
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
    with temp.open('x', encoding='utf-8', newline='\n') as f:
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
                if p.name in {'limits.local.json', 'jsconfig.json'} or '__pycache__' in p.parts or 'app-icons' in p.parts:
                    continue
                # "/" on every system: receipts and PERSONAL compare these names.
                files[p.relative_to(ROOT).as_posix()] = p.read_bytes()
    for name in MANIFEST['appearance_files']:
        files[name] = (ROOT / name).read_bytes()
    return files


def install(home, apply=False, skip_conflicts=False, with_limits=False):
    home = Path(home).resolve()
    if safe(home, RECEIPT).exists():
        raise ValueError('Already installed. Use --update to update it.')
    for name in MANIFEST['mods']:
        if safe(home, 'mods/' + name).exists():
            raise ValueError(f'Name collision: mods/{name}. Existing files are preserved.')
    files = payload()
    if with_limits:
        # The Claude source reads a subscription token from the macOS Keychain
        # and is not offered on Windows (see ACCESS.md).
        files['mods/prodsovet/limits.local.json'] = (
            b'{"claude": false, "codex": true, "antigravity": true}\n'
            if WINDOWS
            else b'{"claude": true, "codex": true, "antigravity": true}\n'
        )
    for name in files:
        if safe(home, name).exists():
            raise ValueError(f'Name collision: {name}')
    original, keys = read_keys(home)
    added = {}
    for section, bindings in json.loads(PACKAGE_KEYS.read_text(encoding='utf-8')).items():
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
        with safe(home, RECEIPT).open('x', encoding='utf-8', newline='\n') as f:
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
    print(f'Installed. Check all five mods, then switch to layout {MANIFEST["layout"]}. Layout was not activated.')
    print('  ' + switch_command(MANIFEST['layout']))


def update(home, apply=False, skip_conflicts=False):
    """Replace an earlier install with this package. Refuses before writing if
    any file it owns was changed, or a new file would replace someone else's."""
    home = Path(home).resolve()
    receipt_path = safe(home, RECEIPT)
    if not receipt_path.exists():
        raise ValueError('Not installed by this installer; run a normal install.')
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    owned = receipt['files']
    files = payload()
    changed = [n for n, d in owned.items() if n not in PERSONAL and not live(n) and safe(home, n).exists() and digest(safe(home, n).read_bytes()) != d]
    if changed:
        raise ValueError('Modified files preserved: ' + ', '.join(sorted(changed)) + '. Save your edits elsewhere and restore or remove them before updating.')
    for name, data in files.items():
        p = safe(home, name)
        if name not in owned and p.exists() and p.read_bytes() != data:
            raise ValueError(f'Name collision: {name}')
    write, backup = {}, []
    for n, d in files.items():
        p = safe(home, n)
        if p.exists() and p.read_bytes() == d:
            continue
        if live(n) and p.exists() and n in owned and digest(p.read_bytes()) != owned[n]:
            # Herdr has written window state into this layout. Keep it while the
            # package's layout is unchanged; otherwise take the new one and
            # leave the old next to it.
            if digest(d) == owned[n]:
                continue
            backup.append(n)
        write[n] = d
    remove = [n for n in owned if n not in files and n not in PERSONAL]
    # Bindings: drop the ones this installer added that the package no longer
    # has (when still unchanged), add the package's new ones.
    original, keys = read_keys(home)
    package = json.loads(PACKAGE_KEYS.read_text(encoding='utf-8'))
    added = {}
    for section, bindings in receipt['added_keys'].items():
        for key, action in bindings.items():
            if package.get(section, {}).get(key) == action:
                added.setdefault(section, {})[key] = action
            elif keys.get(section, {}).get(key) == action:
                del keys[section][key]
                if not keys[section] and section not in receipt['original_sections']:
                    del keys[section]
    for section, bindings in package.items():
        for key, action in bindings.items():
            have = keys.get(section, {})
            if key in have and have[key] != action:
                if not skip_conflicts:
                    raise ValueError(f'Key conflict: {section} / {key}. Use --skip-conflicting-keys to keep it.')
                print(f'KEEP existing binding: {section} / {key}')
            elif key not in have:
                keys.setdefault(section, {})[key] = action
                added.setdefault(section, {})[key] = action
    print(f'{"UPDATE" if apply else "PLAN UPDATE"}: {receipt.get("version", "?")} -> {MANIFEST["version"]}: {len(write)} files written, {len(remove)} removed -> {home}')
    for n in remove:
        print(f'  remove {n}')
    for n in backup:
        print(f'  new layout {n}; yours is kept as {n}.before-update')
    if not apply:
        return
    saved = {n: safe(home, n).read_bytes() for n in [*write, *remove] if safe(home, n).exists()}
    try:
        for name in backup:
            p = safe(home, name)
            p.with_name(p.name + '.before-update').write_bytes(p.read_bytes())
        for name, data in write.items():
            p = safe(home, name)
            p.parent.mkdir(parents=True, exist_ok=True)
            temp = p.with_name(p.name + '.prodsovet-tmp')
            temp.write_bytes(data)
            os.replace(temp, p)
        for name in remove:
            safe(home, name).unlink(missing_ok=True)
        current, _ = read_keys(home)
        if current != original:
            raise ValueError('keys.json changed during the update; retry after closing Herdr.')
        if keys != (json.loads(original) if original else {}):
            atomic_json(home / 'keys.json', keys)
        kept = {n: d for n, d in owned.items() if n in PERSONAL}
        receipt.update(version=MANIFEST['version'], files={**kept, **{n: digest(d) for n, d in files.items()}}, added_keys=added)
        atomic_json(receipt_path, receipt)
    except Exception:
        for name in write:
            if name not in saved:
                safe(home, name).unlink(missing_ok=True)
        for name, data in saved.items():
            safe(home, name).write_bytes(data)
        if original is not None:
            (home / 'keys.json').write_bytes(original)
        raise
    for name in remove:
        parent = safe(home, name).parent
        while parent != home and home in parent.parents:
            try: parent.rmdir()
            except OSError: break
            parent = parent.parent
    print(f'Updated. Check all five mods. Layouts are now {" and ".join(MANIFEST["layouts"])}.')
    try:
        current = json.loads((home / 'shared.json').read_text(encoding='utf-8')).get('layout')
    except (OSError, ValueError, AttributeError):
        current = None
    renamed = MANIFEST.get('former_layouts', {}).get(current)
    if renamed:
        print(f'Your window still uses the former layout name "{current}". Switch with:')
        print('  ' + switch_command(renamed))


def uninstall(home, apply=False):
    home = Path(home).resolve()
    receipt_path = safe(home, RECEIPT)
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    for name, expected in receipt['files'].items():
        p = safe(home, name)
        if p.exists() and digest(p.read_bytes()) != expected:
            if name in PERSONAL or live(name):
                continue  # a personal setting is left in place; layouts carry Herdr's own window state
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
    for name, expected in receipt['files'].items():
        p = safe(home, name)
        if name in PERSONAL and p.exists() and digest(p.read_bytes()) != expected:
            continue
        p.unlink(missing_ok=True)
        parents.update(p.parents)
    receipt_path.unlink()
    # PNGs file-tab converted from the person's installed apps (not shipped).
    made = safe(home, GENERATED)
    if made.is_dir():
        for p in made.glob('*.png'):
            p.unlink()
        parents.add(made)
    for parent in sorted(parents, key=lambda p: len(p.parts), reverse=True):
        if parent == home or home not in parent.parents:
            continue
        try: parent.rmdir()
        except OSError: pass


def switch_command(layout):
    """The command that switches layouts. The --name form needs no JSON quotes,
    which Windows PowerShell 5.1 would strip before herdr-app sees them."""
    return f'herdr-app do layout.switch --name {layout}'


def dependencies(home):
    if WINDOWS:
        # Python is the one running this. Herdr finds its own core (hc) on
        # Windows, so hc need not be on PATH. Recycle Bin and clipboard use the
        # Windows API through mods/my-files/system.py and file-ops.py.
        missing = [x for x in ('herdr-app', 'rg') if not shutil.which(x)]
    else:
        missing = [x for x in ('python3', 'herdr-app', 'hc', 'rg') if not shutil.which(x)]
        if platform.system() != 'Darwin':
            missing.append('macOS or Windows (this release supports these two)')
        elif not Path('/usr/bin/trash').is_file():
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
    parser.add_argument('--update', action='store_true', help='Update an earlier install; refuses if you changed its files')
    parser.add_argument('--skip-conflicting-keys', action='store_true')
    parser.add_argument('--with-limits', action='store_true', help='Enable Keychain/Anthropic usage, local Codex session reading, and Antigravity CLI usage')
    args = parser.parse_args()
    if args.uninstall:
        uninstall(args.home, args.apply)
    elif args.update:
        dependencies(args.home.resolve())
        update(args.home, args.apply, args.skip_conflicting_keys)
    else:
        dependencies(args.home)
        install(args.home, args.apply, args.skip_conflicting_keys, args.with_limits)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f'Not completed: {error}', file=sys.stderr)
        sys.exit(1)
