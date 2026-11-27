import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('limits', str(Path(__file__).resolve().parents[1] / 'mods/prodsovet/limits.py'))
limits = importlib.util.module_from_spec(spec)
spec.loader.exec_module(limits)


class ClaudeFromStatusline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'statusline-rate-limits.json'

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, limits_):
        self.path.write_text(json.dumps({'rate_limits': limits_, 'at': 1000}), encoding='utf-8')

    def test_windows_in_the_status_bar_shape(self):
        self.write({'five_hour': {'used_percentage': 25.5, 'resets_at': 5000}, 'seven_day': {'used_percentage': 78, 'resets_at': 9000}})
        self.assertEqual(limits.claude_from_statusline(self.path, now=2000), {
            '5h': {'used': 25.5, 'minutes': 300, 'resets': 5000.0},
            '7d': {'used': 78, 'minutes': 10080, 'resets': 9000.0}})

    def test_a_window_that_has_reset_counts_as_unused(self):
        self.write({'five_hour': {'used_percentage': 90, 'resets_at': 1500}})
        self.assertEqual(limits.claude_from_statusline(self.path, now=2000)['5h']['used'], 0)

    def test_no_limits_yet_is_an_error_not_zeros(self):
        self.write({'five_hour': None})
        with self.assertRaises(LookupError):
            limits.claude_from_statusline(self.path, now=2000)
        with self.assertRaises(OSError):
            limits.claude_from_statusline(Path(self.tmp.name) / 'missing.json')


if __name__ == '__main__':
    unittest.main(verbosity=2)
