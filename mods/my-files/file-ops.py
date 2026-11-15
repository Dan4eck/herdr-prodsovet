"""Local file operations for Herdr. JSON in argv; never interprets a shell string."""
import ctypes
import errno
import json
import os
import shutil
import stat
import subprocess
import sys


def path(value):
    if not isinstance(value, str) or not os.path.isabs(value) or '\0' in value:
        raise ValueError('Нужен абсолютный путь')
    return os.path.normpath(value)


def child(parent, name):
    if not isinstance(name, str) or not name.strip() or name in ('.', '..') or '/' in name or '\0' in name:
        raise ValueError('Введите имя без /, . или ..')
    return os.path.join(path(parent), name)


def copy_exclusive(src, dst):
    info = os.lstat(src)
    if stat.S_ISLNK(info.st_mode):
        os.symlink(os.readlink(src), dst)
    elif stat.S_ISDIR(info.st_mode):
        if os.path.commonpath([os.path.realpath(src), os.path.realpath(dst)]) == os.path.realpath(src):
            raise ValueError('Нельзя скопировать папку внутрь неё самой')
        shutil.copytree(src, dst, symlinks=True, copy_function=copy_exclusive)
    elif stat.S_ISREG(info.st_mode):
        with open(src, 'rb') as source, open(dst, 'xb') as target:
            shutil.copyfileobj(source, target)
        shutil.copystat(src, dst, follow_symlinks=False)
    else:
        raise ValueError('Этот тип файла не поддерживается')
    return dst


def move_exclusive(src, dst):
    if src == dst:
        return dst
    if os.path.isdir(src) and not os.path.islink(src):
        if os.path.commonpath([os.path.realpath(src), os.path.realpath(dst)]) == os.path.realpath(src):
            raise ValueError('Нельзя переместить папку внутрь неё самой')
    if sys.platform != 'darwin':
        raise ValueError('Перемещение сейчас поддерживается на macOS')
    libc = ctypes.CDLL(None, use_errno=True)
    rename = libc.renamex_np
    rename.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(os.fsencode(src), os.fsencode(dst), 4) != 0:  # RENAME_EXCL
        code = ctypes.get_errno()
        if code == errno.EXDEV:
            raise ValueError('Между дисками используйте копирование, затем корзину')
        raise OSError(code, os.strerror(code), dst)
    return dst


def operate(req):
    action = req['action']
    src = path(req['path'])
    if action == 'directory':
        if not os.path.isdir(src):
            raise ValueError('Папка не найдена')
        return {'path': src}
    if action in ('create-file', 'create-folder'):
        dst = child(src, req['name'])
        if action == 'create-file':
            with open(dst, 'x', encoding='utf-8'):
                pass
        else:
            os.mkdir(dst)
        return {'path': dst}
    if action in ('rename', 'copy', 'move', 'duplicate', 'trash'):
        if src == '/' or src == os.path.expanduser('~'):
            raise ValueError('Выберите файл или вложенную папку')
        os.lstat(src)
    if action == 'rename':
        dst = child(os.path.dirname(src), req['name'])
        return {'path': move_exclusive(src, dst), 'old': src, 'kind': 'move'}
    if action in ('copy', 'move'):
        dst = child(req['destination'], req.get('name') or os.path.basename(src))
        if action == 'copy':
            copy_exclusive(src, dst)
        else:
            move_exclusive(src, dst)
        return {'path': dst, 'old': src, 'kind': action}
    if action == 'duplicate':
        name = os.path.basename(src)
        stem, ext = (name, '') if os.path.isdir(src) else os.path.splitext(name)
        for n in range(1, 10000):
            dst = child(os.path.dirname(src), stem + ' copy' + (f' {n}' if n > 1 else '') + ext)
            if os.path.lexists(dst):
                continue
            copy_exclusive(src, dst)
            return {'path': dst, 'old': src, 'kind': 'copy'}
        raise ValueError('Не удалось подобрать свободное имя')
    if action == 'trash':
        if sys.platform != 'darwin':
            raise ValueError('Корзина сейчас поддерживается на macOS')
        result = subprocess.run(['/usr/bin/trash', '-v', src], capture_output=True, text=True)
        if result.returncode:
            raise ValueError(result.stderr.strip() or f'Корзина: код {result.returncode}')
        prefix = f'# Moved "{src}" to "'
        output = result.stdout.rstrip('\n')
        destination = output[len(prefix):-1] if output.startswith(prefix) and output.endswith('"') else None
        return {'old': src, 'path': destination, 'kind': 'trash'}
    raise ValueError('Неизвестная операция')


if __name__ == '__main__':
    try:
        print(json.dumps(operate(json.loads(sys.argv[1])), ensure_ascii=False))
    except Exception as error:
        message = 'Такое имя уже существует. Исходные файлы сохранены.' if isinstance(error, FileExistsError) else str(error)
        print(json.dumps({'error': message}, ensure_ascii=False))
        sys.exit(1)
