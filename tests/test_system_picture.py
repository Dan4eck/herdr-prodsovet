import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('system', str(Path(__file__).resolve().parents[1] / 'mods/my-files/system.py'))
system = importlib.util.module_from_spec(spec)
spec.loader.exec_module(system)


def png(w, h):
    return b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + b'IHDR' + struct.pack('>II', w, h) + b'\x08\x06\x00\x00\x00'


def jpeg(w, h):
    app0 = b'\xff\xe0' + struct.pack('>H', 16) + b'JFIF\x00' + b'\x01\x01\x00\x00\x01\x00\x01\x00\x00'
    sof = b'\xff\xc0' + struct.pack('>HBHH', 17, 8, h, w) + b'\x03' + b'\x01\x22\x00\x02\x11\x01\x03\x11\x01'
    return b'\xff\xd8' + app0 + sof + b'\xff\xd9'


class Picture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'doc' / 'img').mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def test_sizes_from_headers(self):
        for name, data, size in (('a.png', png(640, 480), (640, 480)), ('b.jpg', jpeg(1200, 800), (1200, 800)),
                                 ('c.gif', b'GIF89a' + struct.pack('<HH', 30, 20), (30, 20)),
                                 ('d.bin', b'nothing', (16, 9))):
            p = self.root / name
            p.write_bytes(data)
            self.assertEqual(system.picture_size(p), size, name)

    def test_relative_picture_is_copied_into_the_cache_once(self):
        (self.root / 'doc' / 'img' / 'x.png').write_bytes(png(10, 5))
        req = {'src': 'img/x.png', 'dir': str(self.root / 'doc'), 'cache': str(self.root / 'cache')}
        first = system.picture(req)
        self.assertEqual((first['w'], first['h']), (10, 5))
        self.assertTrue((self.root / 'cache' / first['file']).is_file())
        self.assertEqual(system.picture(req)['file'], first['file'])
        file_url = {**req, 'src': 'file:///' + str(self.root / 'doc' / 'img' / 'x.png').replace('\\', '/')}
        self.assertEqual(system.picture(file_url)['file'], first['file'])

    def test_missing_files_and_other_formats_are_errors(self):
        req = {'dir': str(self.root / 'doc'), 'cache': str(self.root / 'cache')}
        with self.assertRaises(ValueError):
            system.picture({**req, 'src': 'img/none.png'})
        (self.root / 'doc' / 'notes.txt').write_text('x')
        with self.assertRaises(ValueError):
            system.picture({**req, 'src': 'notes.txt'})
        with self.assertRaises(ValueError):
            system.picture({**req, 'src': 'https://example.com/clip.mp4'})


if __name__ == '__main__':
    unittest.main(verbosity=2)
