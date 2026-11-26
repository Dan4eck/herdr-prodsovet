# ProdAdvice Advanced (PA-Advanced)

Every agent, under its project. Projects, worktrees and agent sessions share one sidebar tree, and each agent has an animated pixel mascot that works, waits for you or rests. Beside the terminal: file tabs with an editor and Markdown preview, project search, Git Changes, GitHub and Issues. Drag a file into a terminal to paste its path. Fork a Claude Code or Codex conversation with one key. English interface, Russian one click away. macOS, plus a Windows port. The layout is PA-Advanced.

![Illustration of PA-Advanced with fictional data](preview.png)

**Adding it:** the package needs more than `layouts/` and `mods/`. PA-Advanced uses
the themes `PA-Advanced-Night` and `PA-Advanced-Day` and key bindings, which a plain
copy of those two folders leaves out. Install the stable tag `v0.7.0` with its own
installer: read ACCESS.md, run `python3 install.py` (a dry run that writes nothing;
`py install.py` on Windows), show the plan to the person, then repeat with `--apply`.
Leave `--with-limits` off unless they ask for it. The installer stops on a name or
key that is taken and does not switch the layout; the last step is
`herdr-app do layout.switch --name PA-Advanced`, on both systems. Details under
[Installer](#installer).

## What you see

Two layouts come in the package: PA-Advanced, described here, and PA-Light (below).
Each has its own thumbnail in Settings > Look (`layouts/pa-advanced.png`,
`layouts/pa-light.png`; the `.svg` files are the editable sources).

The root is a row. Left sidebar: 241 px (min 44 / max 480), with a 42 px brand
header, the PROJECTS / SESSIONS tree (min 90) and the 69 px stock workspace footer.
The work column has 42 px tabs, a flexible body and a 20 px status strip. The body
has 8 px padding and gap. Right panel: 294 px (min 280 / max 900), a stack of Files,
Changes, GitHub and Issues. Pane headers are 30 px with radius 0, gap 8 and a
one-pixel border; the focused pane's border uses the accent color. Terminal padding
is 14/12. Mod type sizes and main row heights come from appearance_profiles.json.
Each profile owns a full independent set of values; see APPEARANCE.md.

PA-Advanced uses the agency-page look: canvas #000000, chrome #030403, terminal
#050705, rules #292a29, square frames (style.radiusScale 0), Avenir Next UI,
Bodoni 72 brand title, JetBrains Mono labels and its own PA-Advanced-Day paper
palette. On Windows the Mac fonts fall back to system ones.

PA-Light keeps the original look: separate Spaces and Workshop panels, rounded panes
(radius 10), Files and Changes at the right. Its dark palette is canvas/chrome
#030303, background #090909, foreground #f3f4ef, border #262626, accent #39ff14.
Focused Codex panes use #090b0e / #7797ba; Claude panes use #0b0a09 / #b3927b.
Its light mode uses the PA-Light-Day sage/green palette.

The illustration in preview.png is made from preview.html and fictional data;
it is not a screenshot or native rendering evidence. Its artwork is the shipped
mascot sprites.

## How it behaves

Working agents animate; blocked agents request attention; done agents show a
completed state; idle agents sleep. Each kind has four 16-frame horizontal PNG
strips. Codex uses the original Codex companion; Claude uses Clawd from the
Claude Code welcome screen. Antigravity uses a bubbling flask, Gemini the custom astronaut, Hermes the
adapted Nous girl. Unknown kinds use the robot. All sprite strips match the
installed personal mod.
Pane/tab status scanners use the small animated bars defined in creatures.js.
Cards focus their agent; grouping, sorting, pinning and attention state use Herdr
metadata. The blocked count pulses in the status strip. Agent counters require
Herdr to report the corresponding state; do not infer activity from a live PID.

Opening a file creates/focuses a file tab in its originating space. Roots are
persisted per space, separate from the tree's browsed location. Switching to a
file tab or old home-directory terminal must not change the project root.
Cmd/Ctrl+T and split commands explicitly pass the root and space. Tree Up goes
to the parent and selects the directory just left; Down enters the selected
directory. Folder clicks expand/collapse. Icon tooltips are intentionally absent.
The context menu has file operations, no open-folder-here/goto/workspace entries.
The path label and Cmd+Shift+G retain explicit folder navigation.

File operations reject overwrites. Rename/move update open descendants; dirty
or saving documents block conflicting operations. Trash requires confirmation;
trashed documents remain visible but cannot be saved. Drafts survive reloads.
The editor detects conflicting disk changes. Tree filter applies to expanded
rows; full search uses ripgrep. Keyboard bindings are listed in README/keys.json.

Session forks resolve exact conversation identity, verify it twice and start a
new agent tab in the captured space/cwd. Errors stay in the popup. No guessing
by newest conversation. Limits are disabled unless limits.local.json explicitly
enables each source. Missing credentials/changed APIs should leave a source
unavailable while the rest of the interface remains usable.

## Built from

Classic node tree: root -> sidebar(brand, sidebar-lists(spaces, agents), sidebar-footer)
and work(tabs, work-body(main, panel(panel-body(files, changes))), status).
See layouts/PA-Light.json for exact weights and content props.

prodsovet implements brand, agents, pane, status, toast, zoo, tabs, new-menu and
tab-menu roles, plus the Changes panel in both layouts. Its commit suggestion
helper reads a local diff and runs an isolated GPT-6-Luna request. A Conventional
Commits subject fills the input directly; manual edits win. The explicit commit
action stages and commits files.
The default pane/header role and overlay role are selected by
props. my-files implements tree/menu/dialog views; file-tab is an editor view;
find and session_fork are popup mods. The layout's toast delegates to prodsovet.

Stock dependencies: spaces, workspace-chrome, pane, tabs, files, changes,
worktree; stock icons in icons/. These remain supplied by Herdr, not vendored.
Runtime modules: herdr, gpui-kit, gpui-base. No DOM, Node or browser inside mods.
Local imports cannot leave the mod directory. filesystem.js is canonical in
my-files and copied verbatim with a generated header into three dependent mods.

Herdr APIs include spaces/panes/focused/terminals/agents/knownAgents, shared and
setShared, props/theme/settings/keys/window/layout, readTextFile/writeTextFile,
exec, run, nextCommand, openOverlay/closeOverlay, notify and setAgentOrder.
Commands include tab.new/close/focus, terminal.open, agent focus, layout changes,
window controls and custom workspace-aware terminal/split commands. Consult the
source and installed herdr.d.ts for exact signatures.

Windows: the same mods. filesystem.js holds the platform layer (python(),
copyText/readClipboard/pasteInto, openExternal, reveal, and path helpers that
accept `\`, drive letters and UNC roots and compare Windows paths without case).
Local Windows actions go through mods/my-files/system.py (clipboard, open,
Explorer; Windows API through ctypes) and file-ops.py (os.rename without
replace, Recycle Bin through SHFileOperationW). Other machines (`on`) stay Unix.
Keys come from keys.windows.json. Python runs as `py -3 -X utf8`. Claude limits
are macOS-only (ACCESS.md says why). filesystem.js is also copied into
session_fork, which needs python().

Programs: Python 3, hc, rg, Git, shell utilities, macOS open/pbcopy/pbpaste/trash;
security only for opted-in Claude limits and `agy` only for opted-in Antigravity limits; on macOS `lsof` and SQLite for
Antigravity conversation titles. See ACCESS.md for data flow. Uses
macOS renamex_np(RENAME_EXCL) to prevent destination clobbering. Python standard
library only. Runtime state is supplied by each user's Herdr, never by a package.

## Watch out

Pin compatible Herdr APIs; v0.7.0 was tested with Herdr App 0.1.18 and Core 0.1.22, not all future releases. Do not copy
personal settings/state or replace a user's keys wholesale. Keep exact mod names
unless rewriting every reference and key scope together. Native check does not
exercise async callbacks, all roles or real interactions. A terminal PID is not
a conversation ID. Codex title format and Claude session metadata are external
prerequisites. Limit collection relies on provider-specific formats, not stable
billing APIs. The file tree has 500-per-directory / 5,000-total caps; text reads
are limited by Herdr to 1 MiB in the tested version. No multi-select, drag-and-drop between folders or
remote file mutations. Cross-volume move fails; source must survive.

The public mascot artwork matches the personal build; retain NOTICE and all
license files. Generated gpui-kit types and private backups are
not source files to redistribute. Agent lifecycle hooks are not installed here.

## Done when

1. Package verification and regression tests pass on macOS.
2. Each of the five mods passes herdr-app check.
3. A fresh install adds only package files/keys, detects collisions and can be
   uninstalled without deleting unrelated keys/state or modified files.
4. With no local limits config, neither credentials nor session logs are read.
5. In native Herdr: open a document, create a terminal, switch spaces and verify
   each root; navigate Up/Down; edit/save/rename; try a Trash confirmation; search.
6. Exercise all four agent states and inspect narrow window clipping. Confirm
   enabled limits use the installing user's account, and test fork prerequisites.

Items 5-6 are a manual acceptance procedure, not a claim that every case was
rerun for this distribution. Actual evidence is recorded in VALIDATION.md.

## Appearance architecture

appearance_profiles.json is canonical. sync_appearance.py generates one local
appearance.js helper per mod, the native themes, root font settings and the second
layout key scope. Herdr forbids imports across mod directories, so generated
helpers are identical copies. Each reads the active shared layout name; both
layouts reference the same feature modules and use the same runtime documents.
Layout geometry remains in each native layout JSON and survives regeneration.
The optional profile `style` block switches drawing details (radius scale,
brand font/chip, label font, selection bar); without it the classic look is drawn. Original pre-refactor code is
preserved by the tag prodadvice-classic-2026-11-15.

## Unified project tree (PA-Advanced)

The second layout uses one `projects` role in sidebar-lists. Agents owns the
existing session cards; projects.js builds repository/checkout headers and
project-model.js resolves Git identity and groups stable workspace roots.
The canonical Git common directory plus machine identifies a project; the
checkout root identifies its worktree. Cache keys and fold state use the
`projects.*.v1` shared namespace. Discovery reads Git asynchronously, checks new
roots on render, and refreshes existing roots at most once per minute while
the window is active. No native spaces are reordered, merged or deleted.

The + menu accepts an explicit Space and uses its saved workspace root for
launches and worktree dialogs. Agent navigation follows project/checkout order.
PA-Advanced ignores pins and draws no pin control. The tree's SESSIONS tab
(`projects.view.v1`) shows the same agents flat, sorted by urgency then recency,
with a project caption; navigation follows that order. Drag reordering
(mouse down/move/up, like the old Spaces list) stores `projects.order.v1`
(project keys) and `projects.sessionOrder.v1` (agent addresses, applied inside
each checkout); `projects.sessionsManual.v1` makes SESSIONS use it. SESSIONS
has two sort buttons (`sessions-sort-status`, `sessions-sort-manual`); by
status it draws foldable Workshop sections (`sessions-sec-<rank>`). Native
spaces are never moved. Adopted subagents in another Space
remain under that Space, while same-Space subagents appear beneath their parent.

`project-context.js` supplies a common checkout scope for the sidebar and tab
bar. Tabs carry their native owner ID; only the active owner's active tab is
highlighted. Selection and keyboard navigation select that owner before its
tab. Panel visibility is remembered per checkout in PA-Advanced.
`open-project.js` resolves an explicitly chosen folder and machine, reuses an
existing checkout or starts the selected first agent/terminal. No inherited
focused cwd is used. The global open action and per-checkout session menu have
distinct responsibilities; only agents appear as sidebar session cards.
`project-ui.js` holds the shared drawing pieces (mono step labels, key chips,
agent glyph tiles, mascots, project letter tiles); `space-colors.js` holds the
Space colors used by both the picker and the project tree. Machines are mono
section headers (monitor/server icon, offline state) in the tree.

## Projects sidebar in detail (PA-Advanced)

PA-Advanced has one Projects sidebar instead of separate Spaces and Workshop
panels. Each repository contains its main sessions and nested worktree sessions.
Click a session to focus it, a project/worktree name to select its Space, and a
chevron to fold the group. The + beside a checkout starts a session or opens the
worktree dialog for that checkout, even when another Space is selected.

Agent sprites, statuses and subagents remain available. PA-Advanced has no
pinning; existing pins are ignored there (PA-Light keeps them).
The SESSIONS tab beside PROJECTS lists every agent session in one list, most
urgent and most recent first, each card naming its project (and worktree
branch); the chosen tab is remembered. Drag to reorder: project headers
within their machine, sessions within their checkout on PROJECTS, and any
session on SESSIONS. The order is shared by both tabs. SESSIONS has two sort
buttons, as the old Workshop had: by status (clock; NEED YOU / DONE / WORKING /
RESTING sections that fold) and your own order (a flat list; new sessions on
top). A drag switches to your own order. Plain terminals are shown only in the top tab bar, without grey
placeholder cards in the sidebar. Open files also appear only in the top tab
bar. The sidebar lists agent sessions beneath projects and worktrees.
Each worktree keeps its own native Space, files and Changes panel. Git identities
and folds persist locally; closing the main Space does not remove its worktree
group. Unavailable checkouts retain their cached association and show a warning.
Legacy missing folders under Herdr's managed worktree path can be associated with
an unambiguous open repository of the same managed name; arbitrary folders are
never grouped by name alone. PA-Light retains its original two-panel sidebar.

The single **Open…** action (Cmd+N) asks for the computer, then the first
session (Terminal by default), then the project folder. Confirming a local
folder in Finder opens it immediately with the selected terminal or agent.
Canceling Finder leaves the chooser open. Remote folders take an absolute path
on the selected machine and use an explicit Open button. An already open checkout is selected instead of duplicated.
The + beside a project and the + in the tab bar only start sessions/worktrees
for that checkout. Once a remote machine is known, projects are split under
THIS MAC and one mono header per machine (with its offline state); headers
have no creation button. A project row shows its letter tile, name, agent
count and +; a branch appears only when it is not main/master, and a folded
project shows its loudest non-idle status.

The top tab bar combines all existing Spaces for the same checkout, including
legacy duplicates. Worktrees and different machines retain separate tab sets.
Ctrl+Tab / Ctrl+Shift+Tab and Cmd+Shift+] / Cmd+Shift+[ follow that same tab set.
Existing terminals are not moved or stopped. Drag reordering stays within the
native owning Space; clicking or keyboard navigation can cross duplicate Spaces.


## Details (moved from README in 0.4.0)

### Conversation forks and agent status

Forking never guesses the newest conversation. Codex needs a title beginning
with its thread ID: inside Codex run `/title thread-id thread-name project-name`.
The resolver accepts a complete UUID or a uniquely matching long prefix in its
local session database. Claude needs the per-process session metadata supplied
by compatible Claude Code versions. The resolver checks identity twice before
launching a fork. Unsupported versions report an error instead of guessing.

Status cards show what Herdr reports. A running process with no reported
`working` status will not count as working. This package does not install
Codex/Claude lifecycle hooks or change their global configurations.

### Commit message suggestions

Both layouts' Changes panels suggest a commit subject from the current local
diff using GPT-6-Luna with low reasoning effort through an installed, logged-in
Codex CLI. A Conventional Commits subject (`fix:`, `feat:`, `refactor:`, etc.)
appears directly in the message field after changes settle, with no shortcut
hint. Enter or Commit then commits all changes, as before.
Typing your own message takes precedence. Changed diffs invalidate old
suggestions; identical diffs reuse the result. Failed requests have a Retry link.
Remote repositories keep manual commit messages.

The CLI runs ephemerally in a temporary directory with a read-only sandbox,
without user configuration, hooks or shell tools. A bounded diff excerpt and
file names are sent through your Codex account; known credential-file contents
and binary contents are omitted. Large changes may be summarized incompletely.
Generation uses your normal Codex allowance. Review the proposed message before
committing; generating or prefilling a message does not stage or commit files.

### Limits of this release

File tree: one selected item at a time. Rows drag their path onto a terminal (local
files are copied to a remote one by Herdr); there is no drag-and-drop between folders. Directory listing is capped at
500 entries per folder and 5,000 total. File loading uses Herdr's text-file API
(1 MiB limit in the tested version). Saves detect changes on disk; open dirty
files block rename/move/Trash. Cross-volume cut/move fails without deleting the
source; use copy and then Trash. Changes view and Git decorations need Git.

The public build includes the same mascot sprite strips as the original personal
mod: Codex companion, Claude's Clawd, Gemini astronaut, Hermes girl and the
generic robot for unknown agents. See [NOTICE](NOTICE) for attribution.

### Installer

The installer does not activate the layout or change agent settings. It uses
`HERDR_APP_HOME` when set; otherwise `~/.config/herdr-app`. `--home PATH` overrides
that location; use the same location for checks and subsequent uninstall.

Existing mod/layout/theme names cause a stop before writing anything. Existing
bindings with different actions also cause a stop; review the conflict and use
`--skip-conflicting-keys` to keep your bindings. Missing shortcuts can be assigned
manually afterwards. No `--force` overwrite mode is provided.

### Updates

An update replaces only files the installer wrote and nobody changed since,
removes files the new version no longer has, and adds new key bindings. If you
edited a package file, it stops before writing and names the file: save your
edits elsewhere, put the original back (or delete the file) and run it again.
`limits.local.json` is yours and is kept. Layout files are not treated as your
edits: Herdr writes window state into them (panel sizes, the open side panel).
Yours is kept while the new version leaves that layout unchanged; otherwise the
new one is installed and yours stays beside it as `….json.before-update`. Updating from 0.3 renames the layouts
(ProdAdvice → PA-Light, ProdAdvice2 → PA-Advanced); the
installer prints the switch command if your window still uses an old name.

### Uninstall

Save your documents and switch to another layout before uninstalling. Uninstall
refuses to delete modified package files; your own files, runtime state, an
edited `limits.local.json` and bindings you changed stay. Files Herdr's own
checks create in a mod folder (`jsconfig.json`, `gpui-kit.d.ts`) keep that
folder. A later install then stops at the existing folder names. Look inside each
leftover folder first; if only those two generated files are left, move the folders
to a backup outside `mods/` and install again. The receipt
`.herdr-prodsovet-install.json` tracks ownership; do not publish it.

### Development checks

Run `python3 -B verify.py` on macOS. Tests use temporary files; one Trash test
moves its own fixture to the system Trash and brings it back for cleanup.
After source changes, run the five native Herdr checks and try the affected UI.
`filesystem.js` in `my-files` is canonical; the copies in the three other mods
must match except for their generated header. `verify.py` checks this.
