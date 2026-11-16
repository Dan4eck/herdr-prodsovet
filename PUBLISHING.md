# Development and releases

Repository: https://github.com/Dan4eck/herdr-prodsovet (public). Description:
"ProdAdvice: workspace-aware files, editor tabs, search and animated agents for Herdr. macOS."

## Day to day

`main` is the development branch; people install tagged releases. The author's
own Herdr runs the working copy:

1. Change code in this repository (never in `~/.config/herdr-app/mods`: the
   next update refuses files changed there).
2. `python3 dev.py` runs `verify.py`, updates your Herdr from this copy with
   `install.py --update --apply` and runs the native `herdr-app check` for all
   five mods; Herdr reloads the mods by itself. `python3 dev.py --fast` skips
   `verify.py` for quick visual iterations; run the full one before committing.
3. Commit and push to `main` in small steps. Add a line for anything a user
   would notice under **Unreleased** in CHANGELOG.md.
4. When a change adds or removes files, regenerate CHECKSUMS.sha256 (sorted
   `shasum -a 256` of the tracked files except itself).

## Release

When Unreleased holds enough:

1. Pick the version (`0.x.0` for features, `0.x.y` for fixes) and set it in
   `manifest.json`; set `herdr_tested` to the Herdr version you tested with.
2. Move the Unreleased lines in CHANGELOG.md under that version with the date;
   leave Unreleased empty.
3. `python3 -B verify.py`, then a clean install and an update in a temporary
   home (`install.py --home /tmp/x`, from the previous tag then this one) and
   the manual checks in RECIPE that the release touched. Record them in
   VALIDATION.md.
4. Regenerate CHECKSUMS.sha256, commit "release: vX.Y.Z", tag `vX.Y.Z`, push
   the commit and the tag.
5. Create the GitHub release from the tag with that CHANGELOG section as notes,
   plus the tested Herdr/macOS versions and known limitations.

Never publish local state: receipts, `data/`, `shared.json`, `view.json`,
credentials, caches or screenshots of private projects. Keep topic
`herdr-layout` (and `herdr-mod`). Preserve the mods' shared API copies, record
changes to access or external integrations in ACCESS.md, and never add a
blanket force-overwrite installer.
