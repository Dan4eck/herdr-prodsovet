# ProdAdvice

A dark Herdr workspace with spaces and animated agents at the left, terminal or
file tabs in the center, a file tree at the right and a compact bottom status
strip. Russian labels, workspace-aware navigation and optional account limits.

![Illustrated layout with fictional data](preview.png)

## What you see

In Settings > Look the layouts are named ProdAdvice and ProdAdvice-Advanced. Each has a custom dark thumbnail
with its name, Codex/Claude mascots, terminal and file tree. The root preview
points to layouts/prodadvice.png; layouts/prodadvice.svg is the editable source.

The root is a row. Left sidebar: 241 px, min 44 / max 480; 46 px brand header,
a weighted spaces/agents column and 69 px stock workspace footer. The brand
header keeps the Herdr icon/name, with ProdAdvice underneath in 9.5 px
semibold using the same inherited UI font. Its muted green is #7d9a72 in dark
mode and #527148 in light mode; line heights are 17/12 px. Main work
column: 42 px tabs, flexible body, 20 px status strip. Body has 8 px padding/gap;
right panel 294 px, min 280 / max 900, a files/changes stack. Pane headers are
30 px with radius 10, gap 8 and a one-pixel border. Terminal padding is 14/12.
Status type is 10 px with 10 px horizontal spacing. Mod type sizes and main row heights come from appearance_profiles.json. Each
profile owns a full independent set of values; see APPEARANCE.md.

ProdAdvice-Light dark palette: canvas/chrome #030303, background #090909, foreground #f3f4ef,
border #262626, accent #39ff14. Focused Codex panes use #090b0e / #7797ba;
Claude panes use #0b0a09 / #b3927b. ProdAdvice light mode uses the custom ProdAdvice-Light-Day sage/green palette.
ProdAdvice-Advanced uses the agency-page look: canvas #000000, chrome #030403, terminal
#050705, rules #292a29, square frames (pane radius 0, style.radiusScale 0),
Avenir Next UI, Bodoni 72 brand title, JetBrains Mono labels and its own
ProdAdvice-Advanced-Day paper palette. Geometry matches ProdAdvice. See APPEARANCE.md.

The illustration in preview.png is made from preview.html and fictional data;
it is not native rendering evidence. The artwork files are the shipped sprites.

## How it behaves

Working agents animate; blocked agents request attention; done agents show a
completed state; idle agents sleep. Each kind has four 16-frame horizontal PNG
strips. Codex uses the original Codex companion; Claude uses Clawd from the
Claude Code welcome screen. Gemini uses the custom astronaut, Hermes the
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
See layouts/ProdAdvice-Light.json for exact weights and content props.

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

Programs: Python 3, hc, rg, Git, shell utilities, macOS open/pbcopy/pbpaste/trash;
security only for opted-in Claude limits. See ACCESS.md for data flow. Uses
macOS renamex_np(RENAME_EXCL) to prevent destination clobbering. Python standard
library only. Runtime state is supplied by each user's Herdr, never by a package.

## Watch out

Pin compatible Herdr APIs; tested on 0.1.15, not all future releases. Do not copy
personal settings/state or replace a user's keys wholesale. Keep exact mod names
unless rewriting every reference and key scope together. Native check does not
exercise async callbacks, all roles or real interactions. A terminal PID is not
a conversation ID. Codex title format and Claude session metadata are external
prerequisites. Limit collection relies on provider-specific formats, not stable
billing APIs. The file tree has 500-per-directory / 5,000-total caps; text reads
are limited by Herdr to 1 MiB in the tested version. No multi-select/drag-drop or
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

## Unified project tree (ProdAdvice-Advanced)

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
ProdAdvice-Advanced ignores pins and draws no pin control. The tree's SESSIONS tab
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
tab. Panel visibility is remembered per checkout in ProdAdvice-Advanced.
`open-project.js` resolves an explicitly chosen folder and machine, reuses an
existing checkout or starts the selected first agent/terminal. No inherited
focused cwd is used. The global open action and per-checkout session menu have
distinct responsibilities; only agents appear as sidebar session cards.
`project-ui.js` holds the shared drawing pieces (mono step labels, key chips,
agent glyph tiles, mascots, project letter tiles); `space-colors.js` holds the
Space colors used by both the picker and the project tree. Machines are mono
section headers (monitor/server icon, offline state) in the tree.

## Projects sidebar in detail (ProdAdvice-Advanced)

ProdAdvice-Advanced has one Projects sidebar instead of separate Spaces and Workshop
panels. Each repository contains its main sessions and nested worktree sessions.
Click a session to focus it, a project/worktree name to select its Space, and a
chevron to fold the group. The + beside a checkout starts a session or opens the
worktree dialog for that checkout, even when another Space is selected.

Agent sprites, statuses and subagents remain available. ProdAdvice-Advanced has no
pinning; existing pins are ignored there (ProdAdvice-Light keeps them).
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
never grouped by name alone. ProdAdvice-Light retains its original two-panel sidebar.

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
