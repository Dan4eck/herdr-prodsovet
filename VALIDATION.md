# Validation record

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
