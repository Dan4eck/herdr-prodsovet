# Validation record

## Windows port (unreleased)

Date: 2026-11-16. Host: Windows 11 Home 26300 x64, Python 3.13.5, Node.js 26.3,
ripgrep 15.1. Herdr App was not installed on this host, so nothing below was
checked in the native window.

Passed:

- `python -B verify.py`: structure, JSON, both key files bind the same
  commands, five identical filesystem.js copies, LF-only files, privacy scan;
  43 Python cases (5 skipped: 4 need symlinks, which Windows allows only with
  Developer Mode; 1 is the macOS Trash) and all Node suites, including 11
  Windows platform cases, 16 dialog/editor integration cases that run the real
  file-ops.py, and 36 project tree cases that run real Git on Windows paths.
- Real Windows file operations: Cyrillic names, case-only rename, refusal of an
  existing name, invalid and reserved names, drive root and home refused,
  copy/duplicate/move, Recycle Bin for a file and a folder (the test removes its
  own items from the Recycle Bin afterwards).
- system.py on the real clipboard: Cyrillic text round trip (~50 ms a call),
  delayed write, refusal of programs and unknown links; the previous clipboard
  text was restored.
- ripgrep output with `--path-separator /` and `--null` matches the parser.
- install / update / uninstall into a temporary home seeded with Herdr's real
  Windows `keys.json`: 132 files, 21 bindings, no key conflicts, defaults kept,
  no CRLF installed, `{"claude": false, "codex": true}` with `--with-limits`,
  uninstall restored keys.json exactly.

Native Herdr App 0.1.16 on the same host (fresh home, Windows PowerShell 5.1
terminals), driven with `herdr-app do` and checked with `herdr-app shot`:

- `py install.py --apply` into the real home: 131 files, 21 bindings, no
  conflicts with Herdr's Windows defaults; `herdr-app status` reports no errors.
- `herdr-app check` passed for all five mods.
- PA-Advanced renders: THIS PC and the branch in the status strip, Windows
  window buttons, `Ctrl+Shift+P COMMANDS`; the PA-Advanced font fallback is
  readable.
- A Git test project with Cyrillic names: one project in PROJECTS, the file tree
  lists Cyrillic names with Git marks, the file tab opens `Заметки\план.md`
  with its text and a `~\…` folder label, Find lists files through ripgrep
  (`/` relative paths, newest first) with Windows key hints, Changes shows the
  diff with Cyrillic text.
- Python inside Herdr: the fork popup on a PowerShell terminal answers with
  resolve.py's own Russian message, so `py -3 -X utf8 -c <script>`, the core
  lookup (`hc get` reports `powershell.exe` with pid and cwd as foreground) and
  UTF-8 output all work. The commit helper's snapshot runs; generation stops
  with "Codex unavailable" because no Codex CLI is installed on this host.

Clicks and keys in the native window (mouse and keyboard on the real window;
frames read with `herdr-app shot`, because screen capture returned blank
frames on this host):

- Context menu labels: Show in Explorer, Delete to Recycle Bin…
- Show in Explorer opened an Explorer window on the project folder.
- Rename… with a Cyrillic name renamed the file on disk and in the tree; the
  open tab followed the rename after the file-tab fix below.
- Delete to Recycle Bin…: Windows wording in the confirmation; the file left the
  folder and was found in the Recycle Bin (then removed from it by hand).
- Ctrl+Shift+S opened Find; Text mode found Cyrillic lines in two files.
- Ctrl+Enter put `@C:\…\Заметки\план.md ` into the terminal and the previous
  clipboard text came back.
- Ctrl+Shift+T opened a terminal tab and Ctrl+Shift+O split it, both in the
  project root; Ctrl+S saved Cyrillic text in the editor.

Found and fixed during the check (both also apply to macOS):

- A new file tab started before Herdr listed its pane, kept no tab id and never
  registered its document, so a rename did not reach the open editor. The tab
  now looks for its pane again (every 200 ms, up to 5 s).
- Find closed its popup before awaiting the clipboard; closing ends the mod
  copy and cancelled the Windows helper, so nothing was pasted. It now closes
  once the clipboard is ready. Cmd/Ctrl+Enter also no longer opens the file in
  a tab as well (the input's submit event fires for it too).

With live agents (Claude Code 2.1.304 from npm on the person's own Max plan,
Codex CLI 0.169.0 from npm on their ChatGPT plan, both started from the
project's + menu or Herdr's own space/tab commands; the person typed every
prompt):

- The + menu lists installed agents (Claude Code, Codex, Hermes) and marks the
  rest "not installed"; the Open project dialog shows THIS PC and Windows
  labels (its native folder picker could not be driven blind here).
- Herdr reports both agents through OSC 7501 (`claude-code`, `codex`): agent
  card and count in PROJECTS, AGENTS in the status strip, done/idle states.
- Ctrl+Enter from Find put `@…\src\main.js ` into Codex's input.
- Commit subject from the real Codex: `chore: remove readme and add a…`.
- Ctrl+Shift+Y in Claude Code opened "Claude fork"
  (`claude --resume <id> --fork-session`) with the whole conversation.
- Ctrl+Shift+Y in Codex recognized Codex (`node.exe`) and, without a thread-id
  title, showed the `/title …` instruction with Ctrl+Shift+Y instead of
  guessing. The full Codex fork after `/title` was not run.

Lesson: Herdr had first been started from this agent's shell, so every Herdr
terminal inherited the agent's `CLAUDE_CODE_*` / `ANTHROPIC_*` variables and
Claude Code ran as its child session (no transcript, no session file). Herdr
was restarted from the Start menu for the checks above. Do not start Herdr from
an agent's shell when testing agents.

Not yet checked on Windows: the Codex fork after `/title`, "open in app"
(Alt+Enter) and "Open in" VS Code / Obsidian in the native window (the helper
behind them was tested directly), and the Open project folder picker.

## macOS releases

Date: 2026-11-15. Source package: 0.3.0. Host: macOS, Herdr App 0.1.15,
Python 3.15 and Node.js 22.14.0. Published at https://github.com/Dan4eck/herdr-prodsovet.

## Passed

- ProdAdvice layout name, custom thumbnail and selected state visually verified
  in native Settings > Look. Both profile renders and switching back to the
  original were checked in the installed app. An initial unsupported space in
  the second layout key scope was corrected by using ProdAdvice2. Final native
  status reports ProdAdvice selected and no errors.
- Renamed layout-scoped keys preserved; installer test checks both the new
  layout scope and existence of the referenced preview image.

- 62 automated cases: 10 real filesystem operations, 13 workspace/document-state
  cases, 15 dialog/editor integration cases, 13 installer/disabled-limits/profile-validation cases
  and 11 appearance isolation cases. Profile switching with different editor font
  sizes preserves unsaved text and the disk-conflict baseline in the host mock.
- Installer dry run, actual install and uninstall via its CLI into a temporary
  Herdr home seeded with the stock dependencies. Existing unrelated keys survived.
- Installer cases cover collisions, opt-in limits, user edits, symlinks,
  ownership of bindings and rollback after a write failure.
- Native `herdr-app check` passed for all five exported mod directories.
- JSON structure, local module boundaries, shared API copies and a targeted
  privacy scan passed. Package exported by a source/asset allowlist, not a copy
  of the entire personal app home. No user runtime state or credentials included.
- Browser-rendered illustrated preview inspected at 1280 x 800. All displayed
  projects/tasks are fictional; it is not evidence of native UI behavior.

The Trash test needs normal macOS filesystem permissions; it failed inside the
restricted execution sandbox, then passed with access to the system Trash. It
restores and cleans up only its own fixture. One historical menu assertion was
updated because the goto item was intentionally removed from the current menu.

## Boundaries

Native check validates the initial view, not every role, callback or interaction.
The public package has not been exercised end-to-end in a second interactive
Herdr instance or on a second computer. File/editor behavior was covered through
mocked host integration and the real Python filesystem backend. Live provider
usage requests and conversation forks were not triggered in this preparation.
Do the manual acceptance steps in RECIPE when evaluating a new Herdr version.

The personal installation was not replaced wholesale from this package. The
ProdAdvice brand subtitle was subsequently applied to both the installed and
public prodsovet mod, passed native check and was visually verified in Herdr.
Public-only differences: optional limits configuration, neutral code/notes badges,
portable test paths and corrected fork guidance. All 20 mascot sprite strips
were compared byte-for-byte with the installed personal mod and match.

## License/source review

- Herdr source license: https://github.com/herdrdev/herdr-app/blob/5216e6f9f8c0c281a65e09816c66e4319e671784/LICENSE
- Bundled icon notice: https://github.com/herdrdev/herdr-app/blob/5216e6f9f8c0c281a65e09816c66e4319e671784/defaults/icons/LICENSE-Lucide.txt
- Hermes reference license: https://github.com/NousResearch/hermes-agent/blob/372066215261fa53ea94d30cf112089155830819/LICENSE
- Hermes character reference: https://github.com/NousResearch/hermes-agent/blob/372066215261fa53ea94d30cf112089155830819/apps/desktop/public/nous-girl.png

Codex and Claude mascot strips are included following the project owner's
explicit confirmation that they may be redistributed. Their provenance is
recorded in NOTICE; the project's code license does not relicense third-party
mascots. External-editor raster logos were replaced by neutral badges.

## ProdAdvice light update

Reproduced dark-on-dark Codex prompt text with paper and minimum_contrast=1.
Verified the same live terminal becomes readable with minimum_contrast=4.5,
then checked the custom ProdAdvice-light palette. All five installed mods
passed native check; native status reported no errors. The contrast setting is
user-global, not an invented theme property. A regression case verifies light
mode removes the dark agent pane background and transparent terminal override.

## Agency-inspired ProdAdvice2

Claude Code inspected the current local /agency page and implemented its palette,
typography, square frames, brand chip and mono labels. It passed package tests
and native checks for all five mods with both the default profile and forced
ProdAdvice2. The primary agent then installed the changes and checked the live
render. The classic profile JSON, classic layout and both classic themes remain
identical to the preceding light-theme commit. Stock Herdr components retain
their own shapes; custom mods and the main pane use the new square styling.

## Unified Projects sidebar (2026-11-16)

ProdAdvice2 now renders one projects role instead of Spaces + Workshop. The
classic layout remains unchanged. Project tests use a real temporary Git
repository/worktrees and a mocked Herdr host to exercise new-checkout discovery,
stable roots with a HOME first terminal, cached identity after unavailability,
main-space closure, machine separation, duplicate-space grouping, checkout-local
pins, adopted and cross-checkout subagents, persistent folds, document/shell
navigation, targeted plus-menu launches and the narrow sidebar. Sixteen cases
pass; the full package suite also passes (the macOS Trash fixture needs normal
OS access rather than the restricted sandbox).

Native check passes for the installed prodsovet mod and a separate fixture that
forces the projects role with project/worktree/subagent data. The live personal
ProdAdvice2 sidebar was visually inspected from a native frame through a local
agent-browser session; runtime status reports no errors. Live click callbacks
were covered by the mocked-host tests, not by desktop input automation. Existing
user sessions/worktrees were not created, closed or moved during validation.
The installed layout received only the sidebar-lists replacement; current panel
geometry and the personal main.js differences were preserved with a backup.

## Project usability follow-up (2026-11-16)

The project suite now has 24 passing cases, including hidden plain-terminal
cards, a single explicit project opener, no duplicate machine-header plus,
shared checkout tabs across legacy native Spaces, correct active-tab state,
cross-Space clicks/keyboard navigation, existing-folder reuse, direct agent
launch, explicit terminal-only launch, invalid-path rejection and remote
agent discovery. The full package suite passes.

The installed layout was checked live: the affected checkout displayed its
Codex tab and two existing terminal tabs together. Native next/previous-tab
commands crossed duplicate Spaces and restored the starting tab. The new
project chooser was opened and visually inspected, then closed without
launching anything. The installed mod passed native check and runtime status
reported no errors. No existing sessions were closed, merged or restarted.

## Finder-first opening follow-up (2026-11-16)

Project opening now orders computer, first session, then folder. Terminal is
the default, including after machine changes and late agent discovery. Local
Finder confirmation launches immediately; cancellation leaves the dialog open.
Remote paths retain explicit submission. The project suite had 29 passing
cases, including immediate terminal/agent launch from the picker, cancellation,
duplicate-picker prevention, closing during selection, and terminal launch
while agent discovery is pending. Folder-picker results use a mocked host; no
real user project is created by these tests.

## Agent-only project children (2026-11-16)

Open files are omitted from the Projects tree alongside plain terminals.
Existing project tests verify that the sidebar contains neither a shell card
nor a document row, while the unified top tab bar retains both kinds of tabs.
No document or terminal is closed by this display change.

## ProdAdvice2 project UI polish (2026-11-16)

The open-project dialog, the checkout session popup and the Projects sidebar
were redrawn with the profile's own tokens, pixel icons and mono labels. The
dialog shows numbered steps (computer, first session, folder), computer tiles
with monitor/server icons, session tiles with each agent's Herdr icon and
accent, a dashed Finder target and a footer with the chosen agent's mascot.
Follow-up the same day: machine sections are back as mono headers (THIS MAC,
each remote machine, offline state), and project rows were decluttered: the
letter tile, name, agent count and +; branch only when not a trunk name, status
only on a folded project. A live frame of this sidebar was inspected. Behavior is unchanged: the 29 project cases and
`verify.py` pass, the native check passes, and live frames of the sidebar,
the local dialog and the session popup were inspected in the personal install
(dark, English). The remote-path state, light mode and Russian strings were
checked only through tests and code review, not in a live frame.

## Sessions tab and no pinning (2026-11-16)

ProdAdvice2 cards have no pin control and stored pins no longer reorder a
checkout (classic ProdAdvice keeps pinning). The Projects sidebar has PROJECTS
and SESSIONS tabs; SESSIONS lists all agents flat by urgency and recency with
a project/worktree caption and the same navigation order. The project suite now
has 31 cases (no pin control; the Sessions tab's content, order, click and tab
persistence). A live frame of the Sessions tab was taken by temporarily making
it the default in the installed copy only, then restoring the repository file;
the person's stored tab choice was not written.

## Drag reordering in ProdAdvice2 (2026-11-16)

Project headers (within a machine) and session cards (within a checkout on
PROJECTS, anywhere on SESSIONS) reorder by dragging; native spaces are not
moved. The project suite has 34 cases, including a hand order in SESSIONS,
a click that does not reorder, returning to urgency order, refusing a drag
into another checkout, and a persisted project order. Drag gestures were not
performed in the live window (no pointer automation was used); only a static
live frame after installation was checked.

## One neutral selection (2026-11-16)

Agency selection no longer uses agent colors: a neutral fill for the active
tab, the current session (plus a 2 px bar) and picker rows; hover applies
only to unselected rows. ProdAdvice2 marks as current only the session with
the window's focus (`focused()`), not every tab's focused pane, and project
rows have no fill. A new project case checks this (35 cases). A live frame
after installation showed one highlighted session and a bright active project.

## Sessions sort (2026-11-16)

SESSIONS has the Workshop's two sort buttons: by status, with foldable NEED YOU /
DONE / WORKING / RESTING sections, and your own order, a flat list that a drag
also switches to. A new pixel icon `art/px/order.svg` marks your own order. The
project suite has 36 cases (switching between both sorts, sections present only
by status, a folded section hiding its cards).

## Worktree belonging (2026-11-16)

On PROJECTS everything a project owns hangs on a 1 px rail under its fold arrow:
the main checkout's sessions first, then each git worktree, which branches off
that rail with a short tick and carries its own rail for its sessions; its header
shows the branch in mono and a `WORKTREE` tag. Fold arrows in ProdAdvice2 are
solid 16 px chevrons (`art/px/fold-down.svg`, `fold-right.svg`) instead of pixel
ones. Ids `project-content-<key>` and `checkout-box-<key>` are new;
existing ids are kept. Checked in a live frame of the installed copy (the
PROJECTS view was forced in that copy only for the frame, then restored).
On PROJECTS the current session lights its stretch of the project rail (a 2 px
bar drawn over the rail line, which is now a plain 1 px div painted first) instead of a bar on the card; SESSIONS, which has
no rail, keeps the card bar. The focused-session test checks both placements.

## 0.4.0: layout names, updater, preview (2026-11-16)

Layouts renamed (hyphens, not spaces: Herdr 0.1.16 rejects the whole keys.json when a
`layout:<name>` section contains a space, seen live and reverted at once): ProdAdvice → **PA-Light**, ProdAdvice2 → **ProdAdvice
Advanced** (recommended). Themes: `PA-Light-Night/Day`, `ProdAdvice
Advanced Night/Day`; each profile names its dark theme (`darkThemeName`). Code
asks `advanced()` instead of comparing layout names; former names still map to
their profiles. `install.py --update` replaces an earlier install (refuses on
edited package files, keeps `limits.local.json`, removes files the new version
no longer has, swaps renamed key sections); a home under a linked folder now
installs. Installer suite: 18 cases (update from a simulated 0.3 install, refusal
on an edited file, kept limits, missing install, linked home). Appearance suite:
13 (former names). Herdr 0.1.16 is the tested version. preview.png and the
Advanced thumbnail were redrawn from preview.html/the SVG with fictional data
and rendered with agent-browser; they are illustrations, not native frames.
Renamed again the same day to the short **PA-Advanced** / **PA-Light** (themes
`PA-*-Night`, `PA-*-Day`, previews `layouts/pa-*.png`); the brief
`ProdAdvice-Advanced` / `ProdAdvice-Light` names also map to their profiles and
are listed in `former_layouts` so `--update` removes them and prints the switch.

## Real app icons in "Open in" (2026-11-16)

file-tab shows VS Code's and Obsidian's own icons, converted at run time from
the apps installed on the Mac (`mdfind` by bundle id, else `/Applications`;
`CFBundleIconFile`; `sips -Z 64` to `mods/file-tab/app-icons/<id>.png`, redone
only when the app's icon is newer). No logo is shipped; without the app the
neutral badge stays. The conversion script was run on this Mac: both PNGs were
made, a missing app exits 3, a second run reuses the PNG. The installer neither
packages nor tracks `app-icons/`, and uninstall removes its PNGs. The UI suite
stubs the conversion (no files written into the repository) and checks the
requests and the fallback; the installed menu itself was not opened live.

## Updater and Herdr-written layouts (2026-11-16)

The first live `--update` refused because Herdr writes window state into
`layouts/PA-*.json` (pane header color for the focused agent, the open side
panel, column widths). Layout files no longer block update or uninstall: update
keeps the installed layout while the package's copy is unchanged (receipt digest
equals the package digest), else installs the new one and keeps the old as
`.before-update`; uninstall removes them. Installer suite: 22 cases. A dry run
against the real install now plans one file (file-tab/main.js) and keeps both
layouts.

## Release v0.4.0 (2026-11-16)

`verify.py` passes. In temporary homes with Herdr 0.1.16's stock mods: a clean
install of this tree and an update from the 0.3 commit `f6f2248` both pass
`herdr-app check` for all five mods and leave only the PA-* layouts and themes.
The author's own install was updated from the repository with `--update`
(layouts kept) and runs PA-Advanced without errors; the "Open in" app icons were
confirmed in the live window by the author.
