# Changelog

Each release is a Git tag `vX.Y.Z` with GitHub release notes taken from its
section here. Work between releases goes under **Unreleased** as it is
committed; the release moves it under the new version.

## Unreleased

- PA-Advanced: an Issues panel next to Files, Changes and GitHub (button "Issues" above the panel). It lists the
  repository's issues (open/closed, mine, GitHub search), shows one with its comments, and creates, edits, comments,
  closes (second click) or reopens issues, toggles labels, assigns you, and pastes an issue into the agent. Uses `gh`.
- Open project fills in the chosen computer's home folder, so Open (or Enter) works right away; another folder
  can still be typed in or picked in Finder.
- Open project drops the footer that repeated the chosen session; the sidebar's Open button is now a single
  frameless Finder-style folder icon.
- Sub-agents in the sidebar tree can be managed: hover shows Detach to a tab (or Send back for a detached one)
  and a menu; right-click opens the same menu with Peek/Show, Detach right or below, and Stop (asks with a second click).
- The commit message is suggested only while the Changes panel is on screen and the window is in front, so a hidden
  panel no longer spends model quota; showing it again catches up.
- Claude Code no longer shows as working forever after its turn ends while background shells it started (a dev
  server) keep running: a report of only "N shells still running" counts as done, with the done sound and a
  notification, until you look at that agent; then it is idle. Sidebar, tabs, pane header and status bar agree.
- A file tab reloads a file that another program changed on disk (when the tab has no unsaved edits), so a generated
  document no longer shows stale text or a stale preview.
- Markdown preview in a file tab now draws pictures: `![alt](path)`, `<img>`, `<figure>` with a caption, and
  `<video>` as a still frame with a play badge. Paths may be relative to the file, absolute, `~/`, `file://`
  or `https://` (downloaded once into `data/md-preview`). macOS only; Windows and remote files keep the text preview.

## 0.5.0 (2026-11-17)

- PA-Advanced: a drop line no longer shows on hover after a click on a
  row's fold, `+` or pin button.

- Windows project identities ignore path case and separator differences, including UNC paths; reopening a project reuses its existing Space.
- Package validation checks raw bytes to reject CRLF line endings.

- **Windows support.** `py install.py --apply` installs the same five mods and
  two layouts on Windows 10/11 with Herdr's Windows key conventions
  (`keys.windows.json`: Ctrl+Shift instead of Cmd, Ctrl+S in the editor,
  Delete for the Recycle Bin in the file tree).
- Windows: Recycle Bin, Explorer, clipboard and "open in default app" through
  the Windows API (`mods/my-files/system.py`, `file-ops.py`); no shell strings.
  Programs and scripts are not opened from the file tools.
- Windows: paths with `\` and drive letters work across the tree, editor tabs,
  search, project grouping (Git's `C:/x` and Herdr's `C:\x` are one checkout)
  and the managed worktree folder.
- Windows: Python is found as `py -3` (not the Store's `python3` stub) and runs
  in UTF-8 mode; Russian messages from the helpers are no longer garbled.
- Commit suggestions read the diff in the helper instead of passing it in
  argv, which would pass Windows' command line limit.
- Claude limits stay macOS-only; on Windows `--with-limits` enables Codex only.
- Go to folder keeps the normalized path; a typed `C:\x/y` matches the tree.
- A file tab that starts before Herdr lists its pane (seen on Windows) looks
  for its tab again, so renames, moves and Trash reach the open editor.
- Session fork on Windows: when the pane's process is Claude Code's launcher,
  the session of its one child process is used (found through the process
  tree, never by age); npm Codex running as `node.exe` is recognized.
- Find: Cmd/Ctrl+Enter no longer also opens the file in a tab, and "to agent"
  and "in app" finish before the popup closes (closing it cancelled the slower
  Windows clipboard and open helpers).
- `.gitattributes` keeps LF line endings on every checkout (Herdr and the
  installer compare files byte for byte); `verify.py` refuses CRLF files.
- Installer receipts always use `/` in file names.

## 0.4.0 (2026-11-16)

- Layouts renamed: ProdAdvice → **PA-Light**, ProdAdvice2 → **PA-Advanced**
  (recommended). Themes `PA-*-Night` / `PA-*-Day`. Former names still work and
  `install.py --update` moves an existing install over.
- PA-Advanced: one PROJECTS / SESSIONS sidebar instead of Spaces + Workshop.
  Projects with their worktrees on a rail, the current session lit on it,
  machine sections, drag to reorder, Sessions sorted by status or by hand.
- Open project dialog (Cmd+N): computer → first session → folder.
- Session menu (+) per project or worktree; unified top tabs per checkout.
- GitHub panel; neutral selection; solid fold arrows; agent icons and mascots.
- "Open in" shows the installed VS Code / Obsidian icons (converted locally,
  no logo shipped).
- `install.py --update`: updates an earlier install, keeps layouts Herdr wrote
  window state into and `limits.local.json`, refuses on edited package files.
- Tested with Herdr 0.1.16.

## 0.3.0

- First public package: ProdAdvice and ProdAdvice2 layouts, files, editor,
  search, conversation forks, opt-in limits.
