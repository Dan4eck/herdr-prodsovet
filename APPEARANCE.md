# Two independent appearances

Select **ProdAdvice** or **ProdAdvice2** in Settings > Look (Cmd+Shift+L also
opens the layout picker). ProdAdvice preserves the original dark design and includes its own light palette.
ProdAdvice2 is an independent profile modeled on the ProdAdvice agency page
(see "ProdAdvice2 design source" below).
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
| `brandColors` | ProdAdvice subtitle color (or chip fill with `style.brandChip`) in dark/light modes |
| `darkTheme` | Terminal ANSI and semantic interface palette |
| `agentPalettes`, `agentTints` | Codex/Claude pane colors and whether to apply them |
| `lightTheme` | Installed light theme name |
| `lightPalette` | Optional owned light palette, generated under `lightTheme`; null uses an existing theme |
| `style` | Optional drawing style (below); omitted means the classic ProdAdvice drawing |

`style` keys, each optional: `radiusScale` (0..2, multiplies every custom-mod
corner radius; 0 gives square frames), `brandFont` (brand title font, null uses
`fonts.ui`), `labelFont` (`"ui"` or `"mono"` for section labels, the Files
header/path and the status strip), `brandChip` (subtitle as an inverse chip
filled with `brandColors`), `selectionBar` (2 px accent bar on selected agent
and file rows). The classic values are 1, null, `"ui"`, false, false; they are
constants in `sync_appearance.py`, not values borrowed from the other profile.
`agency` (true/false) turns on the agency-page decoration described below.
`agentAccents` maps agent kinds (`claude`, `codex`, `gemini`, `hermes`,
`other`) to `{dark, light}` colors; with it, working states, rails, spinners,
selection bars and the active tab's strip use the agent's own color.
ProdAdvice has no `style` block and draws exactly as before.

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
selection, cursor and scroll position can reset. Both profiles use the same
editor font and size, but their syntax palettes differ, so switching between
them can rebuild an open editor. No file is automatically saved.

Before editing, keep a copy of your profile JSON and layouts. The Git tag
`prodadvice-classic-2026-11-15` preserves the original implementation. Package
uninstall refuses to remove locally customized files; preserve those edits and
reconcile them with the installer receipt before updating or uninstalling.

## Light terminal readability

ProdAdvice uses ProdAdvice-light: a pale sage surface, dark ink and deep green
accents. It no longer depends on paper. ANSI colors and UI tokens are separately
defined, and dark agent tints are released when switching to light mode.

Some terminal applications retain explicit dark RGB backgrounds after a theme
switch. In the tested Herdr version, `"minimum_contrast": 4.5` in the user
settings.json makes foregrounds readable against those cell backgrounds. The
personal installation was verified with this setting; it applies to all
terminals, including dark mode. The public installer preserves user settings,
so users with contrast set to 1 should change it themselves if needed.

## ProdAdvice2 design source

Tokens come from the agency page source (`.ag2-*` page tokens and the site
theme), checked against a local render on 2026-11-15:

| Page token | Value | ProdAdvice2 use |
|---|---|---|
| `--site-ink` | `#000000` | dark `canvas` |
| `--ag2-ink` | `#030403` | dark `chrome` (sidebar, tabs, status) |
| media/visual surface | `#050705` | terminal and pane `background` |
| `--ag2-panel` / `--ag2-cell` / `--ag2-raise` | `#0a0c0a` / `#0d100d` / `#141813` | `surface`, `popover` / `hover` / `raised` |
| `--ag2-rule` (paper at 16% on ink) | `#292a29` | `border` |
| paper at 28% / `--ag2-line` (62%) | `#464745` / `#989995` | `input` / preview outer frame |
| `--site-paper` | `#f3f4ef` | `foreground`, `solid`, light `background` |
| `--ag2-text` | `#c9ccc5` | terminal foreground, ANSI white |
| `--ag2-dim` | `#969b92` | `muted` |
| `--site-signal` | `#39ff14` | accent, working, cursor, brand chip |
| `--ag2-alert` | `#ff5a4f` | blocked, ANSI red |
| mint accent on the page | `#7ee7ad` | done, ANSI cyan |

`dim` is `#767f7a`, a slightly lifted page grey that keeps 4.5:1 against the
terminal surface. Character transferred: square 1 px frames, no rounded corners,
an inverse accent chip next to the brand (the page's `AGENCY` badge), uppercase
monospace section labels and a left accent bar on the selected row (the case
list). Halftone, hatch and glitch effects are page decoration and are not
reproduced in a native terminal workspace.

ProdAdvice2-light is the paper version: `#f3f4ef` surfaces, ink text `#0b0d0b`,
rules `#c3c6c0` and a deep signal green `#1f7a0e` (about 4.9:1 on paper) instead of
the neon accent, which is unreadable on light backgrounds.

Fonts: the page uses Avenir Next (UI), Bodoni 72 (display) and `ui-monospace`,
which Chrome on macOS resolves to SF Mono. Avenir Next and Bodoni 72 ship with
macOS; Bodoni 72 has no Cyrillic, so it is only used for the Latin brand title.
SF Mono is a hidden system font on macOS and cannot be selected by family name,
so mono labels, terminal and editor use JetBrains Mono, which is the page's own
declared fallback after SF Mono. Users who install SF Mono from Apple
(https://developer.apple.com/fonts/) may set `fonts.mono` (and terminal/editor)
to `SF Mono`. Apple's license does not allow bundling it here. Fonts are not
bundled; on other systems missing families fall back to Herdr defaults.

## ProdAdvice2 agency decoration (`style.agency`)

Added on 2026-11-15 after the agency page's dashboards. Neon `#39ff14` stays a
brand signal only (PRODADVICE chip, terminal cursor, the title glitch). The
interface accent is paper `#f3f4ef`; statuses use the dashboard colors: working
orange `#ffad55`, blocked coral `#ff8176`, done mint `#7ee7ad`. Agents have
their own colors: Claude orange, Codex sky `#81d4ff`, Gemini periwinkle
`#a6bbff`, Hermes violet `#cc9bfa`, others cyan `#85dee7`. ANSI green, yellow,
blue, magenta and cyan follow the same palette; selection is violet graphite.

Native equivalents of the page's details (tinted one-color SVGs: 15 x 15
solid pixel icons in `mods/prodsovet/art/px`, the halftone in
`mods/prodsovet/art/agency`, and text frames, no canvas):

- brand: "Herdr" alone in one 42 px row, aligned with the tab bar; it flashes an
  offset neon/coral glitch for two frames every ~9 s. SPACES and WORKSHOP glitch
  the same way, much more rarely;
- section titles SPACES, WORKSHOP and FILES share one style: mono, semibold,
  foreground color, the Files text size;
- one neutral "selected" look everywhere (active tab, current session, picker
  row): a 10% paper fill, never an agent's color; the one session with the
  window's focus also gets a 2 px paper bar. Hover is a 4% fill and only on
  rows that are not selected, so pointing at a selected row never changes it.
  In ProdAdvice2 project rows have no fill: the active project reads bright,
  others are muted. Agent colors stay on mascots, icons and working spinners;
- Spaces (`prodsovet` role `spaces`, derived from Herdr's stock mod): square
  letter tiles in the dashboard colors, mono machine headers, pixel icons;
- Workshop: both sort orders as pixel buttons (clock = urgency, layers =
  spaces); section labels get a colored square;
- icons: a 15 px grid, 1 px solid strokes and rounded corners; the Files tree
  keeps dot-matrix type icons and Herdr's chevrons;
- pane headers: a lead running along a dotted rail; pixel split/zoom/close;
- sub-agents: box-drawing tree text, the working branch lit in the agent color;
- empty workshop: a typewriter prompt; a 7 px halftone fades in at the bottom;
- status strip: "1H 34m" (minutes in the last hour with an agent working), plan/fact limit bars (fill is
  usage, the paper tick is an even pace; orange above pace, coral from 80%) and
  the EN/RU language switch.

## Right panel: Files, Changes, GitHub

ProdAdvice2's right panel stacks three blocks, switched by buttons in the tab bar:
Files (`my-files`), Changes (`prodsovet` role `changes`, derived from Herdr's
stock diff panel: status colors, file-type icons, the profile's type) and GitHub
(`prodsovet` role `github`, new). GitHub reads the focused folder's repository
with the `gh` CLI every two minutes or on ↻: branch with ahead/behind and the last
commit, this branch's pull request, review requests, your PRs, other open PRs with
check states, recent workflow runs and open issues. A row opens in the browser;
"@" pastes the link into the space's agent. It is read only. Agency profiles turn
on the Changes and GitHub buttons once through shared `workspace.panels`.

## Language

Every ProdAdvice mod reads `shared("ui.lang")` through `L(en, ru)` from the
generated `appearance.js`. English is the default; EN/RU in the status strip
switches all mods at once. Stock Herdr blocks (footer, settings) keep Herdr's own
language. Input placeholders take the language their view was opened with.

Rollback: Git tag `prodadvice2-pre-agency-2026-11-15` holds the previous
ProdAdvice2 look.
