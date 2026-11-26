# ProdAdvice Advanced (PA-Advanced)

English · [Русский](README.ru.md)

**Every agent, under its project.**

A layout for the [Herdr](https://github.com/herdrdev/herdr-app) desktop app: projects,
worktrees and agent sessions in one sidebar tree, and your files, Git, GitHub and Issues
beside the terminal. The interface is in English, with Russian one click away.

![Illustration of PA-Advanced with fictional data, not a screenshot](preview.png)

## Install

You need macOS, Herdr (opened at least once), Git, `python3` and `rg`
(`brew install ripgrep`). The GitHub and Issues panels also use `gh`. Give this to your
agent:

```text
Install the Herdr layout PA-Advanced from https://github.com/Dan4eck/herdr-prodsovet
at tag v0.7.0. Clone that tag, read ACCESS.md and tell me what the mods run and read.
Run `python3 install.py` on macOS or `py install.py` on Windows (a dry run, it writes
nothing) and show me the plan. After I agree, run it again with --apply, without
--with-limits. If a name or a key is already taken, stop and ask me. Then run
`herdr-app check` on each of the five installed mods and switch with:
herdr-app do layout.switch --name PA-Advanced
```

Please use this prompt rather than the **Copy** line in the Gallery: that line points at
the moving `main` branch, and copying the layouts and mods by hand leaves out the themes,
the thumbnails, the keys and the update receipt.

<details>
<summary>By hand, and Windows</summary>

macOS:

```sh
git clone https://github.com/Dan4eck/herdr-prodsovet
cd herdr-prodsovet
git checkout v0.7.0
python3 install.py           # the plan; writes nothing
python3 install.py --apply
herdr-app do layout.switch --name PA-Advanced
```

Windows 10/11 x64, in PowerShell, with [Python 3](https://www.python.org/downloads/):

```powershell
winget install BurntSushi.ripgrep.MSVC   # if rg is missing; then restart Herdr
git clone https://github.com/Dan4eck/herdr-prodsovet
cd herdr-prodsovet
git checkout v0.7.0
py install.py --apply
herdr-app do layout.switch --name PA-Advanced
```

The Windows port has been there since v0.5.0, but v0.7.0 itself was not run natively on
Windows. Reports are welcome in [Issues](https://github.com/Dan4eck/herdr-prodsovet/issues).

</details>

v0.7.0 was tested on macOS with Herdr App 0.1.18 and Core 0.1.22. The installer stops when a name or key is taken
(`--skip-conflicting-keys` keeps your keys) and never switches your layout by itself.

## What you get

**One tree.** Sessions are grouped by project, worktrees sit on the line of their
project, and the current session is highlighted in place. The SESSIONS tab is the same
agents as one flat list, by status or in your own order. `Cmd+N` opens a project on this
or another machine; `+` starts a session, terminal or worktree.

**Agents you can read at a glance.** Every agent has an animated pixel mascot: it works,
asks for attention, finishes and sleeps. Claude Code, Codex, Gemini, Hermes and
Antigravity each have their own; Antigravity is a bubbling flask. Sub-agents appear
beneath their parent, and a detached one can go back to it from its card or tab menu.
On macOS, Antigravity sessions are named after their conversation.

**Files beside the terminal.** A file tree, file tabs with an editor and Markdown preview,
and project search with `Cmd+Shift+O`: file names, text in files and open terminals.
Drag a file or folder from the tree, or an open file by its name in the editor, onto a
terminal to paste its path. Dropped onto a terminal on another machine, a local file is
copied there by Herdr. A file another program changes reloads in its tab unless you have
unsaved edits.

**Changes, GitHub and Issues.** Review and commit, see the branch, its pull request and
workflows, and read, create and edit issues through your `gh`. While Changes is on screen
it suggests a commit subject by itself: this runs your own Codex CLI, if it is
installed, and sends excerpts of the diff through your Codex account. Nothing is committed until you press Enter or Commit.

**Fork a conversation.** `Cmd+Shift+F` opens a fork of the focused Claude Code or Codex
conversation in a new tab; the original stays where it is. Codex needs
`/title thread-id thread-name project-name` once: see [RECIPE.md](RECIPE.md).

## Keys

| macOS | Windows | Does |
|---|---|---|
| `Cmd+N` | `Ctrl+Shift+N` | open a project |
| `Cmd+P` | `Ctrl+Shift+K` | pick a session |
| `Cmd+T`, `Cmd+D` / `Cmd+Shift+D` | `Ctrl+Shift+T`, `Ctrl+Shift+O` / `Ctrl+Shift+E` | terminal, split right / down in the project root |
| `Cmd+Shift+O` | `Ctrl+Shift+S` | search the project |
| `Cmd+Shift+F` | `Ctrl+Shift+Y` | fork the conversation |
| `Cmd+S` | `Ctrl+S` | save in the editor |

The file tree and search keys are in `keys.json` and `keys.windows.json`.

## Privacy

Mods run programs and work with your files. [ACCESS.md](ACCESS.md) lists what each one
reads, runs and sends. There is no telemetry. The status bar's usage limits are off by
default. They cover Claude, Codex and Antigravity; on macOS the Claude source reads
Claude Code's token from your Keychain and the Antigravity source runs your `agy`, so
read ACCESS.md before turning them on.

## PA-Light

The package also installs PA-Light, with the original look: separate Spaces and Workshop
panels, rounded panes, Files and Changes at the right. New things come to PA-Advanced.

## Update and remove

Update, from the clone (`py` instead of `python3` on Windows). `v0.7.0` is an example,
use the tag of the release you want:

```sh
git fetch --tags
git checkout v0.7.0
python3 install.py --update          # the plan
python3 install.py --update --apply
```

Package files you edited are not overwritten: the update stops before writing and names
them. Layout files are the exception, because Herdr stores panel sizes in them: if a
release changes a layout, the new one is installed and yours stays beside it as
`….json.before-update`.

Remove, after switching to another layout:

```sh
python3 install.py --uninstall --apply
```

`herdr-app check` can leave two generated files in each mod folder, and a later install
then stops there. What to do: [Uninstall](RECIPE.md#uninstall).

## More

[RECIPE.md](RECIPE.md) how it works · [APPEARANCE.md](APPEARANCE.md) fonts, colors, sizes ·
[VALIDATION.md](VALIDATION.md) what was checked · [CHANGELOG.md](CHANGELOG.md) ·
[PUBLISHING.md](PUBLISHING.md) development

If it saves you time, a star on GitHub helps others find it in the Herdr Gallery.

Code under Apache-2.0; third-party material and mascots are in [NOTICE](NOTICE) and
`licenses/`. An unofficial community project, not affiliated with Herdr, Anthropic or
OpenAI.
