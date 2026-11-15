#!/usr/bin/env python3
"""Claude Code and Codex usage limits for the ProdAdvice status bar, as one JSON line.

Claude: the OAuth usage endpoint with Claude Code's own token from the macOS Keychain.
Codex: the latest `rate_limits` that Codex writes into its session logs.
Each window: {"used": percent, "resets": unix seconds, "minutes": window length}.
"""
import glob, json, os, subprocess, time, urllib.request
from datetime import datetime
from pathlib import Path

HOME = os.path.expanduser("~")


def claude():
    raw = subprocess.run(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
                         capture_output=True, text=True, timeout=10).stdout
    token = json.loads(raw)["claudeAiOauth"]["accessToken"]
    req = urllib.request.Request("https://api.anthropic.com/api/oauth/usage", headers={
        "Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20"})
    data = json.load(urllib.request.urlopen(req, timeout=15))
    out = {}
    for key, name, minutes in (("five_hour", "5h", 300), ("seven_day", "7d", 10080)):
        w = data.get(key)
        if w and w.get("utilization") is not None:
            resets = w.get("resets_at")
            out[name] = {"used": w["utilization"], "minutes": minutes,
                         "resets": datetime.fromisoformat(resets).timestamp() if resets else None}
    return out


def codex():
    files = sorted(glob.glob(str(Path(os.environ.get("CODEX_HOME") or Path(HOME) / ".codex") / "sessions/*/*/*/*.jsonl")), key=os.path.getmtime, reverse=True)
    for path in files[:15]:
        last = None
        with open(path, errors="ignore") as f:
            for line in f:
                if '"rate_limits"' in line:
                    last = line
        if not last:
            continue
        rl = json.loads(last).get("payload", {}).get("rate_limits") or {}
        out = {}
        for key in ("primary", "secondary"):
            w = rl.get(key)
            if not w:
                continue
            minutes = w.get("window_minutes") or 0
            name = "5h" if minutes <= 300 else "7d" if minutes >= 10000 else f"{minutes // 60}h"
            used = w.get("used_percent", 0)
            if w.get("resets_at") and w["resets_at"] < time.time():
                used = 0  # the window has rolled over since Codex last reported
            out[name] = {"used": used, "minutes": minutes, "resets": w.get("resets_at")}
        if out:
            return out
    return {}


def main():
    config_path = Path(__file__).with_name("limits.local.json")
    try:
        config = json.loads(config_path.read_text())
        if not isinstance(config, dict):
            config = {}
    except (OSError, ValueError):
        config = {}
    result = {"at": time.time()}
    for name, fn in (("claude", claude), ("codex", codex)):
        if config.get(name) is not True:
            continue
        try:
            result[name] = fn()
        except Exception as error:
            result[name] = {"error": type(error).__name__}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
