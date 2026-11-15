# Publication

Suggested repository: `herdr-prodsovet`, public. Suggested description:
"УПРЯЖ: workspace-aware files, editor tabs, search and animated agents for Herdr. macOS."

This directory is the repository root. Publish only this directory, not the
parent workspace or installed Herdr configuration. Review README, NOTICE and
ACCESS before the first commit. The public package intentionally differs from
the personal install: limits opt-in and neutral external-editor badges. All agent
mascots match the personal install.

1. Run `python3 -B verify.py`; perform the native checks listed in README.
2. Review the final file list and diff, including images. Do not add local state,
   credentials, receipts, caches, old archives or screenshots of private projects.
3. Initialize Git here if necessary, select only the reviewed files and make the
   initial commit. No GitHub account or owner name is embedded in the package.
4. Create the public repository in the desired account and push that commit.
   Creation/push is a separate publishing action; preparation does not do it.
5. Set topic `herdr-layout` (and optionally `herdr-mod`). The installed Herdr
   sharing guide describes catalog discovery by topics. Check catalog behavior
   at publication time; it is an external service, not part of this installer.
6. Tag `v0.1.0`, attach a source archive and include tested Herdr/macOS versions
   plus the known limitations in the release notes.

Future releases: preserve the mods' shared API copies, refresh checks and
compatibility evidence, update manifest version and record any changes to access
or external provider integrations. Never add a blanket force-overwrite installer.
