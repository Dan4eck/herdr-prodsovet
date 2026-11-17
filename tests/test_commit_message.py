import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('commit_message', Path(__file__).resolve().parents[1] / 'mods/prodsovet/commit-message.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class CommitMessage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='herdr-commit-test-')
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.invalid')

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.DEVNULL)

    def baseline(self):
        (self.root / 'app.txt').write_text('old\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'Initial')

    def test_staged_unstaged_and_untracked_without_mutation(self):
        self.baseline()
        (self.root / 'app.txt').write_text('staged\n')
        self.git('add', 'app.txt')
        (self.root / 'app.txt').write_text('working\n')
        (self.root / 'new.txt').write_text('new content\n')
        before = self.git('status', '--porcelain=v1')
        index = self.git('diff', '--cached')
        result = helper.snapshot(self.root)
        self.assertIn('working', result['text'])
        self.assertIn('new content', result['text'])
        self.assertEqual(before, self.git('status', '--porcelain=v1'))
        self.assertEqual(index, self.git('diff', '--cached'))

    def test_same_line_counts_different_content_invalidate(self):
        self.baseline()
        (self.root / 'app.txt').write_text('one\n')
        first = helper.snapshot(self.root)
        (self.root / 'app.txt').write_text('two\n')
        self.assertNotEqual(first['fingerprint'], helper.snapshot(self.root)['fingerprint'])

    def test_initial_commit_includes_both_index_and_worktree(self):
        (self.root / 'new.txt').write_text('first\n')
        self.git('add', '.')
        (self.root / 'new.txt').write_text('second\n')
        result = helper.snapshot(self.root)
        self.assertFalse(result['empty'])
        self.assertIn('second', result['text'])

    def test_private_binary_and_symlink_contents_omitted(self):
        (self.root / '.env').write_text('PRIVATE_VALUE=do-not-send')
        (self.root / 'image.bin').write_bytes(b'\x00private-binary')
        try:  # Windows allows symlinks only with Developer Mode
            (self.root / 'link.txt').symlink_to(self.root / '.env')
        except OSError:
            pass
        text = helper.snapshot(self.root)['text']
        self.assertNotIn('do-not-send', text)
        self.assertNotIn('private-binary', text)
        self.assertIn('contents omitted', text)

    def test_clean_tree_is_empty(self):
        self.baseline()
        self.assertTrue(helper.snapshot(self.root)['empty'])

    def test_generate_uses_isolated_cli_and_stdin(self):
        def run(argv, **kwargs):
            self.assertIn('--ignore-user-config', argv)
            self.assertIn('--ephemeral', argv)
            self.assertEqual(argv[argv.index('--model') + 1], 'gpt-6-luna')
            self.assertIn('model_reasoning_effort="low"', argv)
            self.assertEqual(argv[argv.index('--sandbox') + 1], 'read-only')
            self.assertIn('concrete purpose', kwargs['input'])
            self.assertIn('Conventional Commits', kwargs['input'])
            self.assertIn('bug and patch are not valid types', kwargs['input'])
            self.assertNotIn('HERDR_TERMINAL', kwargs['env'])
            self.assertNotEqual(kwargs['cwd'], str(self.root))
            Path(argv[argv.index('-o') + 1]).write_text('fix(workspace): resolve project root')
            return subprocess.CompletedProcess(argv, 0)
        with patch.dict(os.environ, {'HERDR_TERMINAL': 'fake'}), patch.object(helper.subprocess, 'run', side_effect=run):
            self.assertEqual(helper.generate({'text': 'diff', 'language': 'en'})['message'], 'fix(workspace): resolve project root')

    def test_generate_reads_the_diff_from_root(self):
        # The diff is not passed in argv (Windows limits command lines to 32,767 characters).
        seen = {}
        def run(argv, **kwargs):
            seen['input'] = kwargs['input']
            Path(argv[argv.index('-o') + 1]).write_text('feat: add notes', encoding='utf-8')
            return subprocess.CompletedProcess(argv, 0)
        snap = {'fingerprint': 'f', 'empty': False, 'conflict': False, 'text': 'x' * 40000}
        with patch.object(helper, 'snapshot', return_value=snap) as snapshot, patch.object(helper.subprocess, 'run', side_effect=run):
            self.assertEqual(helper.generate({'root': str(self.root), 'language': 'en'})['message'], 'feat: add notes')
        snapshot.assert_called_once_with(str(self.root))
        self.assertIn('x' * 1000, seen['input'])

    def test_generation_failure_is_actionable(self):
        with patch.object(helper.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            with self.assertRaisesRegex(ValueError, 'CLI login'):
                helper.generate({'text': 'diff'})

    def test_nonconforming_subjects_rejected(self):
        for subject in ('bug: repair it', 'patch: repair it', 'Fix root', 'fix: first\nsecond', 'fix: trailing period.'):
            def run(argv, **kwargs):
                Path(argv[argv.index('-o') + 1]).write_text(subject)
                return subprocess.CompletedProcess(argv, 0)
            with self.subTest(subject=subject), patch.object(helper.subprocess, 'run', side_effect=run):
                with self.assertRaisesRegex(ValueError, 'invalid commit subject'):
                    helper.generate({'text': 'diff'})
