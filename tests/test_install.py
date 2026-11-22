import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('installer', ROOT / 'install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
# The global shortcut of this platform's key file (find: Cmd+Shift+O / Ctrl+Shift+S).
FIND_KEY = next(iter(json.loads(installer.PACKAGE_KEYS.read_text(encoding='utf-8'))['global']))


def can_symlink():
    """Windows allows symlinks only with Developer Mode or as administrator."""
    with tempfile.TemporaryDirectory() as folder:
        try:
            (Path(folder) / 'link').symlink_to(Path(folder) / 'target')
            return True
        except OSError:
            return False


SYMLINKS = can_symlink()


class InstallTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name).resolve() / 'app'
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()

    def tearDown(self):
        self.output.__exit__(None, None, None)
        self.tmp.cleanup()

    def seed(self, keys):
        self.home.mkdir()
        (self.home / 'keys.json').write_text(json.dumps(keys))

    def test_dry_run_writes_nothing(self):
        installer.install(self.home)
        self.assertFalse(self.home.exists())

    def test_install_uninstall_preserves_existing_keys_and_state(self):
        original = {'global': {'cmd-z': 'custom'}, 'empty': {}}
        self.seed(original)
        (self.home / 'shared.json').write_text('{"private":"keep"}')
        installer.install(self.home, apply=True)
        self.assertTrue((self.home / 'mods/prodsovet/main.js').exists())
        layout = json.loads((self.home / 'layouts/PA-Light.json').read_text())
        self.assertTrue((self.home / layout['preview']).is_file())
        self.assertIn('layout:PA-Light', json.loads((self.home / 'keys.json').read_text()))
        self.assertFalse((self.home / 'layouts/prodsovet.json').exists())
        self.assertTrue((self.home / 'layouts/PA-Advanced.json').is_file())
        self.assertTrue((self.home / 'themes/PA-Advanced-Night.json').is_file())
        self.assertTrue((self.home / 'themes/PA-Advanced-Day.json').is_file())
        self.assertIn('layout:PA-Advanced', json.loads((self.home / 'keys.json').read_text()))
        self.assertTrue((self.home / 'appearance_profiles.json').is_file())
        self.assertTrue((self.home / 'sync_appearance.py').is_file())
        self.assertFalse((self.home / 'mods/prodsovet/limits.local.json').exists())
        keys = json.loads((self.home / 'keys.json').read_text())
        keys['global']['cmd-y'] = 'new-user-binding'
        (self.home / 'keys.json').write_text(json.dumps(keys))
        installer.uninstall(self.home, apply=True)
        original['global']['cmd-y'] = 'new-user-binding'
        self.assertEqual(json.loads((self.home / 'keys.json').read_text()), original)
        self.assertEqual((self.home / 'shared.json').read_text(), '{"private":"keep"}')

    def test_key_collision_fails_before_writes(self):
        self.seed({'global': {FIND_KEY: 'custom'}})
        with self.assertRaisesRegex(ValueError, 'Key conflict'):
            installer.install(self.home, apply=True)
        self.assertFalse((self.home / 'mods').exists())

    def test_skip_conflicts_preserves_binding(self):
        original = {'global': {FIND_KEY: 'custom'}}
        self.seed(original)
        installer.install(self.home, apply=True, skip_conflicts=True)
        installer.uninstall(self.home, apply=True)
        self.assertEqual(json.loads((self.home / 'keys.json').read_text()), original)

    def test_mod_collision_preserves_files(self):
        p = self.home / 'mods/find'; p.mkdir(parents=True)
        (p / 'mine.js').write_text('keep')
        with self.assertRaisesRegex(ValueError, 'Name collision'):
            installer.install(self.home, apply=True)
        self.assertEqual((p / 'mine.js').read_text(), 'keep')

    def test_uninstall_refuses_modified_files_before_writes(self):
        installer.install(self.home, apply=True)
        p = self.home / 'mods/find/main.js'; p.write_text('user edit')
        with self.assertRaisesRegex(ValueError, 'Modified file'):
            installer.uninstall(self.home, apply=True)
        self.assertEqual(p.read_text(), 'user edit')
        self.assertTrue((self.home / installer.RECEIPT).exists())

    def test_opt_in_metrics(self):
        installer.install(self.home, apply=True, with_limits=True)
        # Windows offers only the local Codex and Antigravity CLI sources (no Keychain token reading).
        self.assertEqual(
            json.loads((self.home / 'mods/prodsovet/limits.local.json').read_text()),
            {'claude': not installer.WINDOWS, 'codex': True, 'antigravity': True},
        )

    def test_no_prior_keys_removed_on_uninstall(self):
        installer.install(self.home, apply=True)
        installer.uninstall(self.home, apply=True)
        self.assertFalse((self.home / 'keys.json').exists())

    @unittest.skipUnless(SYMLINKS, 'symlinks are not allowed for this user')
    def test_symlink_refused(self):
        self.home.mkdir()
        (self.home / 'mods').symlink_to(Path(self.tmp.name).resolve(), target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            installer.install(self.home, apply=True)

    def old_install(self):
        """An install as 0.3.0 left it: old layout names, an old key section."""
        self.seed({'global': {'cmd-z': 'custom'}})
        installer.install(self.home, apply=True)
        receipt = json.loads((self.home / installer.RECEIPT).read_text())
        old = b'{"old": true}\n'
        (self.home / 'layouts/ProdAdvice2.json').write_bytes(old)
        receipt['files']['layouts/ProdAdvice2.json'] = installer.digest(old)
        receipt['version'] = '0.3.0'
        keys = json.loads((self.home / 'keys.json').read_text())
        keys['layout:ProdAdvice2'] = {'cmd-k': 'old.action'}
        receipt['added_keys']['layout:ProdAdvice2'] = {'cmd-k': 'old.action'}
        (self.home / 'keys.json').write_text(json.dumps(keys))
        (self.home / installer.RECEIPT).write_text(json.dumps(receipt))
        (self.home / 'mods/prodsovet/main.js').write_bytes(b'old code')
        receipt['files']['mods/prodsovet/main.js'] = installer.digest(b'old code')
        (self.home / installer.RECEIPT).write_text(json.dumps(receipt))
        (self.home / 'shared.json').write_text('{"layout":"ProdAdvice2"}')

    def test_update_replaces_owned_files_and_removes_former_ones(self):
        self.old_install()
        installer.update(self.home)  # dry run writes nothing
        self.assertTrue((self.home / 'layouts/ProdAdvice2.json').exists())
        installer.update(self.home, apply=True)
        self.assertFalse((self.home / 'layouts/ProdAdvice2.json').exists())
        self.assertEqual((self.home / 'mods/prodsovet/main.js').read_bytes(), (ROOT / 'mods/prodsovet/main.js').read_bytes())
        keys = json.loads((self.home / 'keys.json').read_text())
        self.assertNotIn('layout:ProdAdvice2', keys)
        self.assertIn('layout:PA-Advanced', keys)
        self.assertEqual(keys['global']['cmd-z'], 'custom')
        receipt = json.loads((self.home / installer.RECEIPT).read_text())
        self.assertEqual(receipt['version'], installer.MANIFEST['version'])
        self.assertNotIn('layouts/ProdAdvice2.json', receipt['files'])
        installer.uninstall(self.home, apply=True)
        self.assertEqual(json.loads((self.home / 'keys.json').read_text()), {'global': {'cmd-z': 'custom'}})

    def test_update_refuses_changed_files_before_writes(self):
        self.old_install()
        (self.home / 'mods/find/main.js').write_text('user edit')
        with self.assertRaisesRegex(ValueError, 'Modified files preserved'):
            installer.update(self.home, apply=True)
        self.assertEqual((self.home / 'mods/find/main.js').read_text(), 'user edit')
        self.assertTrue((self.home / 'layouts/ProdAdvice2.json').exists())

    def test_update_keeps_edited_limits(self):
        installer.install(self.home, apply=True, with_limits=True)
        p = self.home / 'mods/prodsovet/limits.local.json'; p.write_text('{"claude": true, "codex": false}')
        installer.update(self.home, apply=True)
        self.assertEqual(p.read_text(), '{"claude": true, "codex": false}')
        installer.uninstall(self.home, apply=True)
        self.assertEqual(p.read_text(), '{"claude": true, "codex": false}')

    def test_uninstall_removes_converted_app_icons_only(self):
        installer.install(self.home, apply=True)
        icons = self.home / installer.GENERATED; icons.mkdir()
        (icons / 'code.png').write_bytes(b'png')
        installer.uninstall(self.home, apply=True)
        self.assertFalse(icons.exists())

    def test_update_keeps_layouts_herdr_wrote_into(self):
        installer.install(self.home, apply=True)
        p = self.home / 'layouts/PA-Advanced.json'
        p.write_text(p.read_text().replace('"active": "files"', '"active": "changes"'))
        mine = p.read_text()
        installer.update(self.home, apply=True)
        self.assertEqual(p.read_text(), mine)
        self.assertFalse(p.with_name(p.name + '.before-update').exists())

    def test_update_takes_a_changed_package_layout_and_keeps_the_old_one(self):
        installer.install(self.home, apply=True)
        receipt = json.loads((self.home / installer.RECEIPT).read_text())
        receipt['files']['layouts/PA-Advanced.json'] = installer.digest(b'an older package layout')
        (self.home / installer.RECEIPT).write_text(json.dumps(receipt))
        p = self.home / 'layouts/PA-Advanced.json'
        p.write_text('{"window": "state"}')
        installer.update(self.home, apply=True)
        self.assertEqual(p.read_bytes(), (ROOT / 'layouts/PA-Advanced.json').read_bytes())
        self.assertEqual(p.with_name(p.name + '.before-update').read_text(), '{"window": "state"}')

    def test_uninstall_is_not_blocked_by_layout_window_state(self):
        installer.install(self.home, apply=True)
        p = self.home / 'layouts/PA-Light.json'; p.write_text('{"window": "state"}')
        installer.uninstall(self.home, apply=True)
        self.assertFalse(p.exists())

    def test_update_needs_an_install(self):
        with self.assertRaisesRegex(ValueError, 'Not installed'):
            installer.update(self.home)

    @unittest.skipUnless(SYMLINKS, 'symlinks are not allowed for this user')
    def test_home_below_a_linked_folder_installs(self):
        real = Path(self.tmp.name).resolve() / 'real'; real.mkdir()
        link = Path(self.tmp.name).resolve() / 'link'; link.symlink_to(real, target_is_directory=True)
        installer.install(link / 'app', apply=True)
        self.assertTrue((real / 'app/mods/prodsovet/main.js').exists())

    def test_failure_rolls_back_files(self):
        self.seed({'global': {'cmd-z': 'custom'}})
        original = (self.home / 'keys.json').read_bytes()
        with patch.object(installer, 'atomic_json', side_effect=OSError('disk full')):
            with self.assertRaises(OSError): installer.install(self.home, apply=True)
        self.assertEqual((self.home / 'keys.json').read_bytes(), original)
        self.assertFalse((self.home / 'mods/prodsovet/main.js').exists())

    def test_same_binding_not_owned_by_package(self):
        original = {'global': {'cmd-shift-o': 'mod.open:find'}}
        self.seed(original)
        installer.install(self.home, apply=True)
        installer.uninstall(self.home, apply=True)
        self.assertEqual(json.loads((self.home / 'keys.json').read_text()), original)


class LimitsTests(unittest.TestCase):
    def load_limits(self):
        spec = importlib.util.spec_from_file_location('limits', ROOT / 'mods/prodsovet/limits.py')
        limits = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(limits)
        return limits

    def test_disabled_never_reads_credentials_or_sessions(self):
        limits = self.load_limits()
        with patch.object(limits, 'claude', side_effect=AssertionError('credentials accessed')), \
             patch.object(limits, 'codex', side_effect=AssertionError('sessions accessed')), \
             patch.object(limits, 'antigravity', side_effect=AssertionError('agy accessed')), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            limits.main()
        self.assertEqual(set(json.loads(output.getvalue())), {'at'})

    def test_antigravity_usage_parsing_windows_rollover_and_fallbacks(self):
        limits = self.load_limits()
        now = limits.parse_iso_timestamp('2026-11-22T12:00:00Z')
        payload = {
            'status': 'SUCCESS',
            'command': {
                'name': 'usage',
                'data': {
                    'groups': [
                        {
                            'name': 'Gemini Models',
                            'buckets': [
                                {'id': 'gemini-weekly', 'window': 'weekly', 'remaining_fraction': 0.945, 'reset_time': '2026-11-29T11:42:43Z'},
                                {'id': 'gemini-5h', 'window': '5h', 'remaining_fraction': 0.807, 'reset_time': '2026-11-22T16:42:43Z'},
                            ],
                        },
                        {
                            'name': 'Claude and GPT models',
                            'buckets': [
                                {'id': '3p-weekly', 'window': 'weekly', 'remaining_fraction': 0.5, 'reset_time': '2026-11-29T12:00:00Z'},
                                {'id': '3p-5h', 'window': '5h', 'remaining_fraction': 0.25, 'reset_time': '2026-11-22T17:00:00Z'},
                            ],
                        },
                    ],
                },
            },
        }
        parsed = limits.parse_antigravity_usage(payload, now=now)
        self.assertEqual(set(parsed), {'5h', '7d'})
        self.assertAlmostEqual(parsed['5h']['used'], 19.3, places=2)
        self.assertEqual(parsed['5h']['minutes'], 300)
        self.assertEqual(parsed['5h']['resets'], limits.parse_iso_timestamp('2026-11-22T16:42:43Z'))
        self.assertAlmostEqual(parsed['7d']['used'], 5.5, places=2)
        self.assertEqual(parsed['7d']['minutes'], 10080)

        # Exhausted (0 remaining), rolled-over past reset_time, and disabled 5h bucket (free tier).
        free_payload = {
            'status': 'SUCCESS',
            'command': {
                'data': {
                    'groups': [
                        {
                            'name': 'Gemini Models',
                            'buckets': [
                                {'id': 'gemini-5h', 'window': '5h', 'disabled': True, 'remaining_fraction': 0.2, 'reset_time': '2026-11-22T16:00:00Z'},
                                {'id': 'gemini-weekly', 'window': 'weekly', 'remaining_fraction': 0, 'reset_time': '2026-11-29T12:00:00Z'},
                            ],
                        }
                    ]
                }
            },
        }
        free = limits.parse_antigravity_usage(free_payload, now=now)
        self.assertEqual(set(free), {'7d'})
        self.assertEqual(free['7d']['used'], 100.0)

        rolled = limits.parse_antigravity_usage({
            'status': 'SUCCESS',
            'command': {
                'data': {
                    'groups': [
                        {'name': 'Gemini Models', 'buckets': [{'id': 'gemini-5h', 'remaining_fraction': 0.1, 'reset_time': '2026-11-22T11:00:00Z'}]}
                    ]
                }
            },
        }, now=now)
        self.assertEqual(rolled['5h']['used'], 0.0)

        # Fallback by group/window name when IDs differ.
        fallback = limits.parse_antigravity_usage({
            'status': 'SUCCESS',
            'command': {
                'data': {
                    'groups': [
                        {'name': 'Gemini 4 Argon', 'buckets': [{'id': 'argon-w', 'window': 'weekly', 'remaining_fraction': 0.1}]},
                        {'name': 'Gemini Core', 'buckets': [{'id': 'custom-5h', 'window': '5h', 'remaining_fraction': 0.75}]},
                    ]
                }
            },
        }, now=now)
        self.assertEqual(set(fallback), {'5h'})
        self.assertAlmostEqual(fallback['5h']['used'], 25.0, places=2)

        with self.assertRaises(ValueError):
            limits.parse_antigravity_usage({'status': 'ERROR', 'command': {'data': {'groups': []}}}, now=now)
        with self.assertRaises(ValueError):
            limits.parse_antigravity_usage({'status': 'SUCCESS', 'command': {'data': {'groups': []}}}, now=now)

    def test_antigravity_cli_parses_json_and_handles_errors(self):
        limits = self.load_limits()
        sample = json.dumps({
            'status': 'SUCCESS',
            'command': {'name': 'usage', 'data': {'groups': [{'name': 'Gemini Models', 'buckets': [{'id': 'gemini-5h', 'remaining_fraction': 0.8, 'reset_time': '2099-01-01T00:00:00Z'}]}]}},
        })
        fake_ok = type('Result', (), {'returncode': 0, 'stdout': 'log line\n' + sample + '\n', 'stderr': ''})()
        with patch.object(limits, 'agy_command', return_value='/usr/local/bin/agy'), \
             patch.object(limits.subprocess, 'run', return_value=fake_ok) as run_mock:
            out = limits.antigravity()
        self.assertAlmostEqual(out['5h']['used'], 20.0, places=2)
        self.assertEqual(run_mock.call_args.args[0], ['/usr/local/bin/agy', '-p', '/usage', '--output-format', 'json'])

        fake_fail = type('Result', (), {'returncode': 1, 'stdout': '', 'stderr': 'not logged in'})()
        with patch.object(limits, 'agy_command', return_value='/usr/local/bin/agy'), \
             patch.object(limits.subprocess, 'run', return_value=fake_fail):
            with self.assertRaises(RuntimeError):
                limits.antigravity()

    def test_enabled_limits_run_and_isolate_errors(self):
        limits = self.load_limits()
        with tempfile.TemporaryDirectory() as folder:
            script = Path(folder) / 'limits.py'
            (Path(folder) / 'limits.local.json').write_text('{"claude": true, "codex": true, "antigravity": true}\n', encoding='utf-8')
            with patch.object(limits, '__file__', str(script)), \
                 patch.object(limits, 'claude', side_effect=RuntimeError('boom')), \
                 patch.object(limits, 'codex', return_value={'5h': {'used': 10, 'minutes': 300, 'resets': None}}), \
                 patch.object(limits, 'antigravity', return_value={'5h': {'used': 19, 'minutes': 300, 'resets': None}}), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                limits.main()
        data = json.loads(output.getvalue())
        self.assertEqual(data['claude'], {'error': 'RuntimeError'})
        self.assertEqual(data['codex']['5h']['used'], 10)
        self.assertEqual(data['antigravity']['5h']['used'], 19)


    def test_style_block_is_optional_and_strictly_validated(self):
        spec = importlib.util.spec_from_file_location('sync_appearance', ROOT / 'sync_appearance.py')
        sync = importlib.util.module_from_spec(spec); spec.loader.exec_module(sync)
        config = json.loads((ROOT / 'appearance_profiles.json').read_text())
        self.assertNotIn('style', config['profiles']['PA-Light'])
        sync.validate(json.loads(json.dumps(config)))
        for bad in ({'unknown': 1}, {'radiusScale': -1}, {'labelFont': 'serif'}, {'brandChip': 'yes'}):
            broken = json.loads(json.dumps(config))
            broken['profiles']['PA-Advanced']['style'] = bad
            with self.assertRaises(ValueError):
                sync.validate(broken)


if __name__ == '__main__':
    unittest.main()
