import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('file_ops', str(Path(__file__).resolve().parents[1] / 'mods/my-files/file-ops.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


def can_symlink():
    """Windows allows symlinks only with Developer Mode or as administrator."""
    with tempfile.TemporaryDirectory() as folder:
        try:
            (Path(folder) / 'link').symlink_to(Path(folder) / 'target')
            return True
        except OSError:
            return False


SYMLINKS = can_symlink()


def purge_recycled(path):
    """Remove this test's own item from the Windows Recycle Bin: each entry has
    an $I file holding the original path and an $R file holding the item."""
    import shutil
    for folder in (Path(os.path.splitdrive(str(path))[0] + os.sep) / '$Recycle.Bin').iterdir():
        try:
            infos = [p for p in folder.iterdir() if p.name.startswith('$I')]
        except OSError:
            continue  # other users' bins
        for info in infos:
            data = info.read_bytes()
            if struct.unpack_from('<q', data)[0] == 2:
                original = data[28:28 + 2 * struct.unpack_from('<i', data, 24)[0]].decode('utf-16-le').rstrip('\0')
            else:
                original = data[24:544].decode('utf-16-le').split('\0', 1)[0]
            if os.path.normcase(original) == os.path.normcase(str(path)):
                item = folder / ('$R' + info.name[2:])
                shutil.rmtree(item) if item.is_dir() else item.unlink(missing_ok=True)
                info.unlink()
                return True
    return False


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

    @unittest.skipUnless(SYMLINKS, 'symlinks are not allowed for this user')
    def test_rename_no_clobber_even_broken_symlink(self):
        src = self.root / 'a'; src.write_text('keep')
        (self.root / 'b').symlink_to(self.root / 'absent')
        with self.assertRaises(FileExistsError): self.op('rename', src, name='b')
        self.assertEqual(src.read_text(), 'keep'); self.assertTrue((self.root / 'b').is_symlink())

    @unittest.skipUnless(SYMLINKS, 'symlinks are not allowed for this user')
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

    @unittest.skipUnless(sys.platform == 'darwin', 'macOS Trash')
    def test_trash_uses_macos_trash_and_is_recoverable(self):
        src = self.root / 'herdr-test-trash.txt'; src.write_text('recoverable')
        result = self.op('trash', src)
        trashed = Path(result['path'])
        self.assertFalse(src.exists()); self.assertEqual(trashed.read_text(), 'recoverable')
        # Return only this test artifact so tearDown removes it.
        trashed.rename(src)


    @unittest.skipUnless(sys.platform == 'win32', 'Windows Recycle Bin')
    def test_trash_uses_windows_recycle_bin(self):
        file, folder = self.root / 'herdr-test-trash.txt', self.root / 'herdr-test-folder'
        file.write_text('recoverable'); folder.mkdir(); (folder / 'a').write_text('x')
        for src in (file, folder):
            result = self.op('trash', src)
            self.assertEqual((result['kind'], result['old']), ('trash', str(src)))
            self.assertFalse(src.exists())
            # It is in the Recycle Bin; take only this test item out again.
            self.assertTrue(purge_recycled(src))

    @unittest.skipUnless(sys.platform == 'win32', 'Windows names')
    def test_windows_names_case_rename_and_roots(self):
        for name in ('a:b', 'a\\b', 'what?', 'CON', 'nul.txt', 'com1.md', 'trailing.', 'trailing '):
            with self.assertRaises(ValueError, msg=name): self.op('create-file', name=name)
        src = self.root / 'note.md'; src.write_text('x')
        renamed = Path(self.op('rename', src, name='NOTE.md')['path'])
        self.assertEqual(os.listdir(self.root), ['NOTE.md']); self.assertEqual(renamed.read_text(), 'x')
        (self.root / 'other.md').write_text('y')
        with self.assertRaises(FileExistsError): self.op('rename', self.root / 'other.md', name='note.MD')
        drive = os.path.splitdrive(str(self.root))[0] + os.sep
        with self.assertRaises(ValueError): self.op('trash', drive)
        with self.assertRaises(ValueError): self.op('rename', Path.home(), name='x')
        self.assertEqual(self.op('resolve', str(self.root).replace(os.sep, '/'))['path'], os.path.realpath(self.root))


if __name__ == '__main__': unittest.main(verbosity=2)
