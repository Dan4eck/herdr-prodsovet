# Changelog

Each release is a Git tag `vX.Y.Z` with GitHub release notes taken from its
section here. Work between releases goes under **Unreleased** as it is
committed; the release moves it under the new version.

## Unreleased

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
