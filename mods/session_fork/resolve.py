"""Resolve the exact focused conversation. Read-only; never pick 'latest'."""
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys

UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"


def get_terminal(address):
    hc = shutil.which("hc") or str(Path.home() / ".local/bin/hc")
    result = subprocess.run([hc, "get", address], capture_output=True, text=True, timeout=8)
    if result.returncode:
        raise ValueError("Не удалось прочитать текущий терминал Herdr.")
    return json.loads(result.stdout)


def codex_id(title):
    first = title.split(" | ", 1)[0].strip()
    first = re.sub(r"^Thread(?: ID)?[: ]+", "", first, flags=re.I)
    if re.fullmatch(UUID, first):
        return first
    # Codex shortens each title item. Resolve only a long UUID prefix, uniquely.
    match = re.fullmatch(r"([0-9a-fA-F-]{20,35})(?:\.\.\.|…)", first)
    if not match:
        raise ValueError("В этой сессии Codex один раз выполните:\n/title thread-id thread-name project-name\nЗатем снова нажмите ⌘⇧F. Настройка заголовка нужна и для новых запусков.")
    prefix = match.group(1).lower()
    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f-]+", prefix):
        raise ValueError("Заголовок Codex не содержит корректный ID диалога.")
    root = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
    databases = [p for p in root.glob("state_*.sqlite") if re.fullmatch(r"state_\d+\.sqlite", p.name)]
    if not databases:
        raise ValueError("Не найдена локальная база сессий Codex.")
    db = max(databases, key=lambda p: int(p.stem.split("_")[-1]))
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=3) as connection:
        rows = connection.execute("SELECT id FROM threads WHERE id LIKE ? LIMIT 2", (prefix + "%",)).fetchall()
    if len(rows) != 1:
        raise ValueError("ID в заголовке не определяет единственный диалог Codex. Форк не создан.")
    return rows[0][0]


def resolve(terminal, claude_home=None):
    if terminal.get("state") != "live":
        raise ValueError("Исходный терминал уже закрыт.")
    fg = terminal.get("foreground") or {}
    status = terminal.get("status") or {}
    app = status.get("app", "") if isinstance(status, dict) else ""
    executable = Path(fg.get("name", "")).name.lower()
    cwd = fg.get("cwd")
    if not cwd or not fg.get("pid"):
        raise ValueError("Сначала выберите терминал с Codex или Claude Code.")

    if app == "codex" and executable == "codex":
        # thread-id must be the FIRST title item. No history/title matching.
        sid = codex_id(terminal.get("title", ""))
        argv = ["codex", "fork", "--no-daemon", "-c", 'tui.terminal_title=["thread-id","thread-name","project-name"]', sid]
        agent = "Codex"
    elif app in ("claude-code", "claude") and executable in ("claude", "claude.exe"):
        root = Path(claude_home or os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
        path = root / "sessions" / (str(fg["pid"]) + ".json")
        try:
            session = json.loads(path.read_text())
        except (OSError, ValueError):
            raise ValueError("Claude Code не предоставил ID текущей сессии. Обновите Claude Code и откройте сессию заново.")
        sid = session.get("sessionId", "")
        if session.get("pid") != fg["pid"] or not re.fullmatch(UUID, sid):
            raise ValueError("Не удалось подтвердить ID сессии Claude Code.")
        if session.get("cwd") and os.path.realpath(session["cwd"]) != os.path.realpath(cwd):
            raise ValueError("Папка Claude Code изменилась. Повторите после завершения текущего действия.")
        argv = ["claude", "--resume", sid, "--fork-session"]
        agent = "Claude"
    else:
        raise ValueError("Выберите панель, в которой сейчас открыт Codex или Claude Code.")
    return {"agent": agent, "session": sid, "argv": argv, "cwd": cwd, "pid": fg["pid"]}


def main():
    address = sys.argv[1]
    before = get_terminal(address)
    plan = resolve(before)
    after = get_terminal(address)
    again = resolve(after)
    if (again["pid"], again["session"], again["cwd"]) != (plan["pid"], plan["session"], plan["cwd"]):
        raise ValueError("Сессия переключилась во время проверки. Нажмите хоткей ещё раз.")
    print(json.dumps(plan, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
