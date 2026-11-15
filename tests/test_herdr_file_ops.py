import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('file_ops', str(Path(__file__).resolve().parents[1] / 'mods/my-files/file-ops.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class FileOperations(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='herdr-files-test-')
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def op(self, action, path=None, **kwargs):
        return ops.operate({'action': action, 'path': str(path or self.root), **kwargs})

    def test_create_unicode_and_shell_metacharacters(self):
        name = "текст ' $HOME $(touch BAD);.md"
        result = self.op('create-file', name=name)
        self.assertTrue(Path(result['path']).is_file())
        self.assertFalse((self.root / 'BAD').exists())

    def test_create_rejects_existing_file(self):
        p = self.root / 'keep.md'; p.write_text('original')
        with self.assertRaises(FileExistsError): self.op('create-file', name=p.name)
        self.assertEqual(p.read_text(), 'original')

    def test_names_cannot_escape_directory(self):
        for name in ('..', '.', '../escape', 'a/b', '', '\0'):
            with self.assertRaises(ValueError): self.op('create-file', name=name)

    def test_create_folder(self):
        self.assertTrue(Path(self.op('create-folder', name='new_folder')['path']).is_dir())

    def test_copy_collision_preserves_both(self):
        src = self.root / 'a'; src.write_text('a')
        dest = self.root / 'dest'; dest.mkdir(); (dest / 'a').write_text('b')
        with self.assertRaises(FileExistsError): self.op('copy', src, destination=str(dest))
        self.assertEqual(src.read_text(), 'a'); self.assertEqual((dest / 'a').read_text(), 'b')

    def test_rename_no_clobber_even_broken_symlink(self):
        src = self.root / 'a'; src.write_text('keep')
        (self.root / 'b').symlink_to(self.root / 'absent')
        with self.assertRaises(FileExistsError): self.op('rename', src, name='b')
        self.assertEqual(src.read_text(), 'keep'); self.assertTrue((self.root / 'b').is_symlink())

    def test_duplicate_and_copy_directory_preserve_links(self):
        src = self.root / 'folder'; src.mkdir(); (src / 'a').write_text('hello'); (src / 'link').symlink_to('a')
        first = Path(self.op('duplicate', src)['path']); second = Path(self.op('duplicate', src)['path'])
        self.assertNotEqual(first, second)
        self.assertTrue((first / 'link').is_symlink()); self.assertEqual((second / 'a').read_text(), 'hello')

    def test_reject_recursive_copy_move(self):
        src = self.root / 'folder'; src.mkdir()
        for action in ['copy', 'move']:
            with self.assertRaises(ValueError): self.op(action, src, destination=str(src))
        self.assertTrue(src.is_dir())

    def test_move_and_rename(self):
        src = self.root / 'a'; src.write_text('hello')
        renamed = Path(self.op('rename', src, name='б.txt')['path'])
        dest = self.root / 'dest'; dest.mkdir()
        moved = Path(self.op('move', renamed, destination=str(dest))['path'])
        self.assertEqual(moved.read_text(), 'hello'); self.assertFalse(renamed.exists()); self.assertFalse(src.exists())

    def test_trash_uses_macos_trash_and_is_recoverable(self):
        src = self.root / 'herdr-test-trash.txt'; src.write_text('recoverable')
        result = self.op('trash', src)
        trashed = Path(result['path'])
        self.assertFalse(src.exists()); self.assertEqual(trashed.read_text(), 'recoverable')
        # Return only this test artifact so tearDown removes it.
        trashed.rename(src)


if __name__ == '__main__': unittest.main(verbosity=2)
