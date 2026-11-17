import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('resolve', str(Path(__file__).resolve().parents[1] / 'mods/session_fork/resolve.py'))
resolve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolve)

SID = '0b3e2c8e-1a4f-4c1e-9d2b-7f5a6c3e8d10'


class ClaudeSession(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'sessions').mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, pid, sid=SID, cwd='C:\\work'):
        (self.root / 'sessions' / f'{pid}.json').write_text(json.dumps({'pid': pid, 'sessionId': sid, 'cwd': cwd}), encoding='utf-8')

    def test_own_pid_file_is_used(self):
        self.write(100)
        self.assertEqual(resolve.claude_session(self.root, 100, parents={})['sessionId'], SID)

    @unittest.skipUnless(sys.platform == 'win32', 'Windows launcher processes')
    def test_launcher_child_session_is_found_by_ancestry(self):
        # Pane process 100 (launcher) -> 200 (Claude Code). 300 belongs to another app.
        self.write(200)
        self.write(300, sid='11111111-2222-4333-8444-555555555555')
        session = resolve.claude_session(self.root, 100, parents={200: 100, 300: 900, 100: 50})
        self.assertEqual((session['pid'], session['childPid'], session['sessionId']), (100, 200, SID))

    @unittest.skipUnless(sys.platform == 'win32', 'Windows launcher processes')
    def test_no_guessing_without_a_unique_descendant(self):
        self.write(300)
        with self.assertRaises(OSError):
            resolve.claude_session(self.root, 100, parents={300: 900})
        self.write(201); self.write(202)
        with self.assertRaises(OSError):
            resolve.claude_session(self.root, 100, parents={201: 100, 202: 100})

    @unittest.skipUnless(sys.platform == 'win32', 'Windows process snapshot')
    def test_real_process_snapshot_lists_this_process(self):
        import os
        parents = resolve.windows_parents()
        self.assertIn(os.getpid(), parents)
        self.assertEqual(parents[os.getpid()], os.getppid())


if __name__ == '__main__':
    unittest.main(verbosity=2)
