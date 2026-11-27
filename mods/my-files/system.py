"""Windows system actions for the ProdAdvice mods: clipboard text, opening a
file or link, showing a file in Explorer, and caching a picture for the
Markdown preview. JSON request in argv[1], one JSON
line out. Uses the Windows API directly and never runs a shell string.
macOS does these with pbcopy, pbpaste and open, so nothing here runs there."""
import json
import os
import sys
import time

CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002
# Opening these would run them rather than show them.
RUNNABLE = {'.exe', '.com', '.bat', '.cmd', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.psm1',
            '.msi', '.msp', '.msc', '.scr', '.cpl', '.hta', '.pif', '.lnk', '.url', '.reg', '.appref-ms',
            '.application', '.jar', '.py', '.pyw'}
LINKS = ('http://', 'https://', 'vscode://', 'obsidian://')


def api():
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    user32.OpenClipboard.argtypes = [wintypes.HWND]
    user32.OpenClipboard.restype = wintypes.BOOL
    user32.CloseClipboard.restype = wintypes.BOOL
    user32.EmptyClipboard.restype = wintypes.BOOL
    user32.IsClipboardFormatAvailable.argtypes = [wintypes.UINT]
    user32.IsClipboardFormatAvailable.restype = wintypes.BOOL
    user32.GetClipboardData.argtypes = [wintypes.UINT]
    user32.GetClipboardData.restype = wintypes.HANDLE
    user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
    user32.SetClipboardData.restype = wintypes.HANDLE
    kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalUnlock.restype = wintypes.BOOL
    kernel32.GlobalFree.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalFree.restype = wintypes.HGLOBAL
    return ctypes, user32, kernel32


class Clipboard:
    """Another program may hold the clipboard for a moment: retry briefly."""

    def __enter__(self):
        self.ctypes, self.user32, self.kernel32 = api()
        for _ in range(50):
            if self.user32.OpenClipboard(None):
                return self
            time.sleep(0.02)
        raise ValueError('Буфер обмена занят другой программой')

    def __exit__(self, *_):
        self.user32.CloseClipboard()


def clipboard_get():
    with Clipboard() as c:
        if not c.user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
            return None
        handle = c.user32.GetClipboardData(CF_UNICODETEXT)
        if not handle:
            return None
        pointer = c.kernel32.GlobalLock(handle)
        if not pointer:
            return None
        try:
            return c.ctypes.wstring_at(pointer)
        finally:
            c.kernel32.GlobalUnlock(handle)


def clipboard_set(text):
    if not isinstance(text, str):
        raise ValueError('Нужен текст')
    data = text.encode('utf-16-le') + b'\0\0'
    with Clipboard() as c:
        handle = c.kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
        if not handle:
            raise ValueError('Не хватило памяти для буфера обмена')
        pointer = c.kernel32.GlobalLock(handle)
        if not pointer:
            c.kernel32.GlobalFree(handle)
            raise ValueError('Не удалось записать буфер обмена')
        c.ctypes.memmove(pointer, data, len(data))
        c.kernel32.GlobalUnlock(handle)
        c.user32.EmptyClipboard()
        # On success the clipboard owns the memory; free it only on failure.
        if not c.user32.SetClipboardData(CF_UNICODETEXT, handle):
            c.kernel32.GlobalFree(handle)
            raise ValueError('Не удалось записать буфер обмена')


def local_path(value):
    if not isinstance(value, str) or '\0' in value or not os.path.isabs(value):
        raise ValueError('Нужен абсолютный путь')
    path = os.path.normpath(value)
    if not os.path.lexists(path):
        raise ValueError('Файл не найден')
    return path


def open_target(target):
    if not isinstance(target, str) or '\0' in target:
        raise ValueError('Нечего открывать')
    if target.lower().startswith(LINKS):
        os.startfile(target)
        return
    path = local_path(target)
    if not os.path.isdir(path) and os.path.splitext(path)[1].lower() in RUNNABLE:
        raise ValueError('Программы и скрипты не запускаются отсюда. Используйте «Показать в Проводнике».')
    os.startfile(path)


def reveal(value):
    """Explorer with the item selected (an open window of that folder is reused)."""
    import ctypes
    path = local_path(value)
    ole32 = ctypes.WinDLL('ole32')
    shell32 = ctypes.WinDLL('shell32')
    shell32.ILCreateFromPathW.argtypes = [ctypes.c_wchar_p]
    shell32.ILCreateFromPathW.restype = ctypes.c_void_p
    shell32.SHOpenFolderAndSelectItems.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_void_p, ctypes.c_uint]
    shell32.SHOpenFolderAndSelectItems.restype = ctypes.c_long
    shell32.ILFree.argtypes = [ctypes.c_void_p]
    ole32.CoInitialize(None)
    item = shell32.ILCreateFromPathW(path)
    if not item:
        raise ValueError('Проводник не нашёл этот путь')
    try:
        result = shell32.SHOpenFolderAndSelectItems(item, 0, None, 0)
    finally:
        shell32.ILFree(item)
    if result != 0:
        raise ValueError(f'Проводник не открылся (код {result & 0xFFFFFFFF:#x})')


PICTURE_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp')
VIDEO_EXT = ('.mp4', '.mov', '.m4v', '.webm')


def fnv(text):
    """The same 32-bit FNV-1a name md-preview.js gives a cached picture."""
    h = 2166136261
    for unit in text.encode('utf-16-le').decode('utf-16-le'):
        for code in ([ord(unit)] if ord(unit) < 0x10000 else [0xD800 + ((ord(unit) - 0x10000) >> 10), 0xDC00 + ((ord(unit) - 0x10000) & 0x3FF)]):
            h = ((h ^ code) * 16777619) & 0xFFFFFFFF
    return f'{h:08x}'


def picture_size(path):
    """(width, height) from the file's header: PNG, GIF, BMP, JPEG, WebP. (16, 9) if unknown."""
    with open(path, 'rb') as f:
        head = f.read(64 * 1024)
    if head[:8] == b'\x89PNG\r\n\x1a\n' and len(head) >= 24:
        return int.from_bytes(head[16:20], 'big'), int.from_bytes(head[20:24], 'big')
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return int.from_bytes(head[6:8], 'little'), int.from_bytes(head[8:10], 'little')
    if head[:2] == b'BM' and len(head) >= 26:
        return int.from_bytes(head[18:22], 'little', signed=True), abs(int.from_bytes(head[22:26], 'little', signed=True))
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        kind = head[12:16]
        if kind == b'VP8X':
            return 1 + int.from_bytes(head[24:27], 'little'), 1 + int.from_bytes(head[27:30], 'little')
        if kind == b'VP8 ':
            return int.from_bytes(head[26:28], 'little') & 0x3FFF, int.from_bytes(head[28:30], 'little') & 0x3FFF
        if kind == b'VP8L':
            b = int.from_bytes(head[21:25], 'little')
            return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    if head[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(head):
            if head[i] != 0xFF:
                i += 1
                continue
            marker = head[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                return int.from_bytes(head[i + 7:i + 9], 'big'), int.from_bytes(head[i + 5:i + 7], 'big')
            i += 2 + int.from_bytes(head[i + 2:i + 4], 'big')
    return 16, 9


def picture(request):
    """A picture for the Markdown preview, copied into the mod's cache folder (Herdr's
    image() reads files under its home). src: relative to dir, absolute, ~/..., file://
    or https:// (downloaded once). A video gives a frame when ffmpeg is installed."""
    import shutil
    import subprocess
    import urllib.parse
    import urllib.request
    src, base, cache, video = request.get('src'), request.get('dir'), request.get('cache'), bool(request.get('video'))
    if not isinstance(src, str) or not src or not isinstance(cache, str) or not os.path.isabs(cache):
        raise ValueError('Нет картинки')
    os.makedirs(cache, exist_ok=True)
    ext = os.path.splitext(src.split('?')[0].split('#')[0])[1].lower()
    if src.lower().startswith(('http://', 'https://')):
        if ext in VIDEO_EXT:
            raise ValueError('удалённое видео без постера')
        dest = os.path.join(cache, fnv(src) + (ext if ext in PICTURE_EXT else '.img'))
        if not os.path.isfile(dest) or not os.path.getsize(dest):
            req = urllib.request.Request(src, headers={'User-Agent': 'ProdAdvice-Herdr'})
            temp = dest + '.part'
            try:
                with urllib.request.urlopen(req, timeout=40) as r, open(temp, 'wb') as out:
                    shutil.copyfileobj(r, out)
                os.replace(temp, dest)
            except Exception as error:
                if os.path.exists(temp):
                    os.remove(temp)
                raise ValueError(f'не скачалось: {error}') from None
    else:
        if src.lower().startswith('file://'):
            path = urllib.parse.unquote(src[7:])
            path = path[1:] if len(path) > 2 and path[0] == '/' and path[2] == ':' else path
        elif src.startswith('~/') or src.startswith('~\\'):
            path = os.path.join(os.path.expanduser('~'), src[2:])
        elif src[1:3] in (':\\', ':/') or src.startswith('\\\\'):
            path = urllib.parse.unquote(src)
        else:
            if not isinstance(base, str) or not os.path.isabs(base):
                raise ValueError('Нет папки файла')
            path = os.path.join(base, urllib.parse.unquote(src.split('?')[0].split('#')[0]))
        path = os.path.normpath(path)
        if not os.path.isfile(path):
            raise ValueError('нет файла: ' + path)
        ext = os.path.splitext(path)[1].lower()
        if ext in VIDEO_EXT:
            if not video:
                raise ValueError('видео')
            dest = os.path.join(cache, fnv(path) + '-frame.jpg')
            if not os.path.isfile(dest) or not os.path.getsize(dest):
                ffmpeg = shutil.which('ffmpeg')
                if not ffmpeg:
                    raise ValueError('кадр видео не снят (нужен ffmpeg)')
                r = subprocess.run([ffmpeg, '-v', 'error', '-y', '-ss', '1', '-i', path, '-frames:v', '1', '-vf', 'scale=1280:-1', '-q:v', '3', dest],
                                   capture_output=True, timeout=60, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                if r.returncode:
                    raise ValueError('кадр видео не снят (нужен ffmpeg)')
        elif ext in PICTURE_EXT:
            dest = os.path.join(cache, fnv(path) + ext)
            # Windows symlinks need developer mode: a copy, refreshed when the original changes.
            if not os.path.isfile(dest) or os.path.getmtime(dest) < os.path.getmtime(path):
                shutil.copyfile(path, dest)
        else:
            raise ValueError(f'формат {ext} не показывается')
    w, h = picture_size(dest) if not dest.endswith('.svg') else (16, 9)
    return {'file': os.path.basename(dest), 'w': w, 'h': h}


def run(request):
    action = request.get('action')
    if action == 'clipboard-get':
        return {'text': clipboard_get()}
    if action == 'clipboard-set':
        delay = request.get('delay') or 0
        if not isinstance(delay, (int, float)) or not 0 <= delay <= 10:
            raise ValueError('Неверная задержка')
        time.sleep(delay)
        clipboard_set(request.get('text'))
        return {}
    if action == 'open':
        open_target(request.get('target'))
        return {}
    if action == 'reveal':
        reveal(request.get('path'))
        return {}
    if action == 'picture':
        return picture(request)
    raise ValueError('Неизвестное действие')


def main():
    # The answer carries Russian text; Herdr reads it as UTF-8.
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        if sys.platform != 'win32':
            raise ValueError('system.py нужен только на Windows')
        print(json.dumps(run(json.loads(sys.argv[1])), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
