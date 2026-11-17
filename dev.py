#!/usr/bin/env python3
"""Apply this working copy to your own Herdr: checks, update, native checks.

For development only. People who use ProdAdvice install a tagged release
with install.py (see README); this script never commits, tags or pushes.

  python3 dev.py          # verify.py, then install.py --update --apply, then herdr-app check
  python3 dev.py --fast   # skip verify.py (only the update and the native checks)
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODS = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['mods']


def step(title, command):
    print(f'\n== {title}', flush=True)
    if subprocess.run(command, cwd=ROOT).returncode != 0:
        sys.exit(f'Stopped: {title} failed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--fast', action='store_true', help='skip verify.py')
    parser.add_argument('--home', help='Herdr home (default: as install.py)')
    args = parser.parse_args()
    home = ['--home', args.home] if args.home else []
    if not args.fast:
        step('package checks and tests', [sys.executable, '-B', 'verify.py'])
    step('update your Herdr from this copy', [sys.executable, '-B', 'install.py', '--update', '--apply', *home])
    target = Path(args.home).expanduser() if args.home else Path.home() / '.config/herdr-app'
    for mod in MODS:
        step(f'herdr-app check {mod}', ['herdr-app', 'check', str(target / 'mods' / mod)])
    status = subprocess.run(['herdr-app', 'status'], capture_output=True, text=True)
    try:
        errors = json.loads(status.stdout).get('errors', [])
    except ValueError:
        errors = ['herdr-app status did not answer']
    if errors:
        sys.exit('Herdr reports: ' + '; '.join(errors))
    print('\nDone: your Herdr runs this working copy. Commit when you are happy with it.')


if __name__ == '__main__':
    main()
