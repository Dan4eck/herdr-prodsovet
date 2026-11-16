# Changelog

Each release is a Git tag `vX.Y.Z` with GitHub release notes taken from its
section here. Work between releases goes under **Unreleased** as it is
committed; the release moves it under the new version.

## Unreleased

- Nothing yet.

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
