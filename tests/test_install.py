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
        layout = json.loads((self.home / 'layouts/ProdAdvice.json').read_text())
        self.assertTrue((self.home / layout['preview']).is_file())
        self.assertIn('layout:ProdAdvice', json.loads((self.home / 'keys.json').read_text()))
        self.assertFalse((self.home / 'layouts/prodsovet.json').exists())
        self.assertTrue((self.home / 'layouts/ProdAdvice2.json').is_file())
        self.assertTrue((self.home / 'themes/ProdAdvice2.json').is_file())
        self.assertTrue((self.home / 'themes/ProdAdvice2-light.json').is_file())
        self.assertIn('layout:ProdAdvice2', json.loads((self.home / 'keys.json').read_text()))
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
        self.seed({'global': {'cmd-shift-o': 'custom'}})
        with self.assertRaisesRegex(ValueError, 'Key conflict'):
            installer.install(self.home, apply=True)
        self.assertFalse((self.home / 'mods').exists())

    def test_skip_conflicts_preserves_binding(self):
        original = {'global': {'cmd-shift-o': 'custom'}}
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
        self.assertEqual(json.loads((self.home / 'mods/prodsovet/limits.local.json').read_text()), {'claude': True, 'codex': True})

    def test_no_prior_keys_removed_on_uninstall(self):
        installer.install(self.home, apply=True)
        installer.uninstall(self.home, apply=True)
        self.assertFalse((self.home / 'keys.json').exists())

    def test_symlink_refused(self):
        self.home.mkdir()
        (self.home / 'mods').symlink_to(Path(self.tmp.name).resolve(), target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            installer.install(self.home, apply=True)

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
    def test_disabled_never_reads_credentials_or_sessions(self):
        spec = importlib.util.spec_from_file_location('limits', ROOT / 'mods/prodsovet/limits.py')
        limits = importlib.util.module_from_spec(spec); spec.loader.exec_module(limits)
        with patch.object(limits, 'claude', side_effect=AssertionError('credentials accessed')), patch.object(limits, 'codex', side_effect=AssertionError('sessions accessed')), contextlib.redirect_stdout(io.StringIO()) as output:
            limits.main()
        self.assertEqual(set(json.loads(output.getvalue())), {'at'})


    def test_style_block_is_optional_and_strictly_validated(self):
        spec = importlib.util.spec_from_file_location('sync_appearance', ROOT / 'sync_appearance.py')
        sync = importlib.util.module_from_spec(spec); spec.loader.exec_module(sync)
        config = json.loads((ROOT / 'appearance_profiles.json').read_text())
        self.assertNotIn('style', config['profiles']['ProdAdvice'])
        sync.validate(json.loads(json.dumps(config)))
        for bad in ({'unknown': 1}, {'radiusScale': -1}, {'labelFont': 'serif'}, {'brandChip': 'yes'}):
            broken = json.loads(json.dumps(config))
            broken['profiles']['ProdAdvice2']['style'] = bad
            with self.assertRaises(ValueError):
                sync.validate(broken)


if __name__ == '__main__':
    unittest.main()
