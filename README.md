# УПРЯЖ / Herdr Prodsovet

A Russian-language workspace for Herdr: animated agent cards, editable file tabs,
a practical file manager, full-project search and a compact status bar.

![Illustrated preview with fictional demo data](preview.png)

The preview is an illustration of the layout, not a screenshot of a live session.

## What is included

- **prodsovet**: agent list and animated states, tabs/menus, pane headers, theme and a 20 px status bar with optional Claude/Codex limits.
- **my-files**: navigation, tree filter, create file/folder, rename, duplicate, copy/cut/paste, Finder reveal and macOS Trash.
- **file-tab**: text editor, Markdown preview, save, draft recovery and external editor actions.
- **find**: project filename/content search using ripgrep.
- **session_fork**: fork the focused Claude Code or Codex conversation into a new tab.

Workspace roots stay stable when switching between agents and documents.
New terminals and splits start in the current workspace root, even from a file tab.
The mods work together; install the complete bundle for the documented behavior.

## Requirements

- **macOS**, Herdr App **0.1.15** is the tested version. Other versions are unverified.
- `herdr-app`, `hc`, `python3` and `rg` on Herdr's PATH; `/usr/bin/trash` available.
- Open Herdr once so its built-in mods are installed. Stock dependencies are in `manifest.json`.
- Optional: Claude Code, Codex, Visual Studio Code or Obsidian for their respective actions.
- Tests additionally need Node.js 22+; there are no npm or pip dependencies for normal installation.

Windows/Linux file mutations are not supported by this release. Remote browsing
and file reading depend on Herdr's remote support; local macOS mutations do not
become remote operations. Remote forks require Python, `hc` and the agent on the remote machine.

## Install

Download or clone this repository, then run commands **from its root**.
Repository: https://github.com/Dan4eck/herdr-prodsovet

Read [ACCESS.md](ACCESS.md) and the source before installation: mods can execute
programs and read/write the files you work with.

```sh
python3 install.py                 # review the plan; does not write
python3 install.py --apply         # install files and merge new key bindings
for mod in prodsovet my-files file-tab find session_fork; do
  herdr-app check "$HOME/.config/herdr-app/mods/$mod" || break
done
```

If all five checks pass, switch with Cmd+Shift+L, choosing `prodsovet`, or:

```sh
herdr-app do layout.switch '{"name":"prodsovet"}'
```

The installer does not activate the layout or change agent settings. It uses
`HERDR_APP_HOME` when set; otherwise `~/.config/herdr-app`. `--home PATH` overrides
that location; use the same location for checks and subsequent uninstall.

Existing mod/layout/theme names cause a stop before writing anything. Existing
bindings with different actions also cause a stop; review the conflict and use
`--skip-conflicting-keys` to keep your bindings. Missing shortcuts can be assigned
manually afterwards. No `--force` overwrite mode is provided.

You can also ask a coding agent: "Read this repository's README, RECIPE and
ACCESS. Install the complete layout in my Herdr, preserving my mods and keys,
then check all five mods." Follow the collision rules above.

## Limits: explicit opt-in

Limits are **off by default**. To enable both at install time, add `--with-limits`
to the planned and applied install commands. After installation, alternatively
copy `mods/prodsovet/limits.example.json` to `limits.local.json` in the **installed**
mod folder and set `claude` and/or `codex` to `true`.

Claude reads your own `Claude Code-credentials` Keychain item and uses its OAuth
token only against `https://api.anthropic.com/api/oauth/usage`. Codex reads recent
local session logs under `CODEX_HOME` (default `~/.codex`). This is best-effort,
not a billing source: log values may be stale and provider endpoints/formats may
change. Refresh runs about every three minutes. No account data is shipped.
Remove or disable the local config to stop collection on the next refresh.

## Controls

| Context | Key/action | Result |
|---|---|---|
| УПРЯЖ layout | Cmd+T / Ctrl+T | Terminal in the workspace root |
| УПРЯЖ layout | Cmd+D / Cmd+Shift+D | Right/down split in that root |
| Global | Cmd+Shift+O | Project filename/content search |
| Terminal | Cmd+Shift+F | Fork current conversation |
| File tree | F2 | Rename selected item |
| File tree | Cmd+N / Cmd+Shift+N | Create file/folder |
| File tree | Cmd+Shift+G or path label | Enter a folder path |
| File tree | Cmd+C / X / V | Internal file copy/cut/paste |
| File tree | Cmd+Backspace | Trash confirmation |
| File tree | Up/down arrows in toolbar | Parent / selected directory |
| File tree | Enter | Send selected path to the agent |
| File editor | Cmd+S | Save |

Going to the parent selects the directory just left, so the down button returns
there. The tree filter covers expanded rows; full-project search is separate.
Copy/paste is an internal file clipboard, not Finder's clipboard.

## Conversation forks and agent status

Forking never guesses the newest conversation. Codex needs a title beginning
with its thread ID: inside Codex run `/title thread-id thread-name project-name`.
The resolver accepts a complete UUID or a uniquely matching long prefix in its
local session database. Claude needs the per-process session metadata supplied
by compatible Claude Code versions. The resolver checks identity twice before
launching a fork. Unsupported versions report an error instead of guessing.

Status cards show what Herdr reports. A running process with no reported
`working` status will not count as working. This package does not install
Codex/Claude lifecycle hooks or change their global configurations.

## Limits of this release

One selected item at a time; no drag-and-drop. Directory listing is capped at
500 entries per folder and 5,000 total. File loading uses Herdr's text-file API
(1 MiB limit in the tested version). Saves detect changes on disk; open dirty
files block rename/move/Trash. Cross-volume cut/move fails without deleting the
source; use copy and then Trash. Changes view and Git decorations need Git.

The public build includes the same mascot sprite strips as the original personal
mod: Codex companion, Claude's Clawd, Gemini astronaut, Hermes girl and the
generic robot for unknown agents. See [NOTICE](NOTICE) for attribution.

## Uninstall and updates

Save your documents and switch to another layout before uninstalling; close
file tabs opened by this bundle. Keep the installer available.

```sh
python3 install.py --uninstall           # inspect removal
python3 install.py --uninstall --apply   # remove unchanged owned files/bindings
```

Uninstall refuses to delete modified package files. Back up your edits separately
and reconcile them before continuing. In particular, keep a copy of
`limits.local.json` if you enabled/edited it after installation. User-created
files and runtime state remain. Updated user key bindings remain. The receipt
`.herdr-prodsovet-install.json` tracks ownership; do not publish it.

For v0.1.x updates: preserve local changes, uninstall the old package using its
installer/receipt, install the new version, and reapply your changes. There is
no automatic updater and no silent replacement of customized code.

## Development and publication

Run `python3 -B verify.py` on macOS. Tests use temporary files; one Trash test
moves its own fixture to the system Trash and brings it back for cleanup.
After source changes, run the five native Herdr checks and try the affected UI.
`filesystem.js` in `my-files` is canonical; the copies in the three other mods
must match except for their generated header. `verify.py` checks this.

See [RECIPE.md](RECIPE.md) for architecture, [VALIDATION.md](VALIDATION.md) for
what has actually been checked, and [PUBLISHING.md](PUBLISHING.md) for release steps.

Apache-2.0 for project code/custom contributions; third-party notices and asset
exceptions are in [NOTICE](NOTICE) and `licenses/`. Unofficial community project.
