# Two independent appearances

Select **ProdAdvice** or **ProdAdvice2** in Settings > Look (Cmd+Shift+L also
opens the layout picker). Both initially look the same. ProdAdvice preserves
the original design; ProdAdvice2 is a separate starting point for a redesign.
The feature code, file operations, workspace roots and documents are shared.

## Editing a profile

Edit `appearance_profiles.json` in the installed Herdr home, normally
`~/.config/herdr-app`. Change only `profiles.ProdAdvice2` for the new design.
Then run:

```sh
python3 ~/.config/herdr-app/sync_appearance.py
```

When working on the repository, edit its JSON and run `python3 sync_appearance.py`
from the repository root instead. This updates the repository only. `--home PATH`
targets another already-installed bundle using the configuration beside the script.
`--check` checks generated files without writing. The script preserves the active
layout and each layout's geometry. Herdr hot-reloads the resulting files.

| Profile field | Controls |
|---|---|
| `fonts.ui` | Inherited interface font |
| `fonts.terminal`, `fonts.terminalSize` | Terminal font and size |
| `fonts.mono`, `fonts.editor` | Mod monospace labels and file editor font |
| `text` | Text sizes for individual mod roles |
| `weights` | Medium, semibold and bold weights |
| `metrics` | Main row, toolbar, input and menu heights |
| `brandColors` | ProdAdvice subtitle color in dark/light modes |
| `darkTheme` | Terminal ANSI and semantic interface palette |
| `agentPalettes`, `agentTints` | Codex/Claude pane colors and whether to apply them |
| `lightTheme` | Installed light theme name, initially `paper` |

For example, set `profiles.ProdAdvice2.fonts.ui` to an installed font family,
`profiles.ProdAdvice2.text.files.body` to `14`, and
`profiles.ProdAdvice2.brandColors.dark` to `#8dabb5`. Colors use `#rrggbb`.
Font files are not bundled; install a custom font before selecting it.
Increase the corresponding row height if larger text needs more room.

Each profile owns all values, with no inheritance from the other. Keep the
profile names and layout filenames aligned. Generated `appearance.js` files
must not be edited directly; regeneration replaces them.

## Layout and host boundaries

For panel widths, padding and overall arrangement, edit the corresponding
`layouts/ProdAdvice.json` or `layouts/ProdAdvice2.json`. These are independent.
The generator updates their font/theme/preview fields while retaining geometry.
Stock Herdr components retain their own sizing rules; `text` and `metrics`
control the custom mods. Some small icon sizes and padding remain in mod code.
Choosing a different theme in Herdr overrides that layout's palette until the
next profile synchronization. Agent tinting applies only with the profile's
own dark theme selected.

Changing an open file editor's actual font, size or syntax palette rebuilds its
native editor: unsaved text and conflict detection are retained, but undo history,
selection, cursor and scroll position can reset. Switching the two initially
identical profiles does not rebuild the editor. No file is automatically saved.

Before editing, keep a copy of your profile JSON and layouts. The Git tag
`prodadvice-classic-2026-11-15` preserves the original implementation. Package
uninstall refuses to remove locally customized files; preserve those edits and
reconcile them with the installer receipt before updating or uninstalling.
