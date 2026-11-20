# Access and data flow

The installer copies files locally and merges selected key bindings. It does not
contact GitHub, change your active layout, install agent hooks or upload data.

| Component | Access / side effects |
|---|---|
| File manager | Lists chosen workspace folders, reads Git metadata, executes Python filesystem operations on selected local paths. Can create, rename, copy, move and send items to macOS Trash after user actions. |
| File editor | Reads/saves selected files through Herdr. Unsaved drafts persist in local mod storage. External editor actions run `open`. To show the real VS Code/Obsidian icons it finds the installed apps (`mdfind`, else `/Applications`), reads their icon name (`PlistBuddy`) and converts the icon once with `sips` into `mods/file-tab/app-icons/` (removed on uninstall). Nothing is downloaded. |
| Search | Runs `rg` and shell utilities in the workspace. Can open results or send selected text/path to the focused agent via terminal input and clipboard. |
| Clipboard actions | Use `pbcopy`/`pbpaste`; temporary clipboard replacement/restoration is possible when sending text to an agent. |
| Tabs / agents | Read Herdr space/terminal/agent metadata and Git repository identity; persist project associations and fold state locally; user actions can launch terminals/agents or close tabs. Focused agent may change pane styling in this layout. A sub-agent's menu can give it a pane, send it back or stop it (`terminal.keep`/`park`/`kill`) after explicit user actions. A Claude Code turn that ends with background shells plays Herdr's done sound and posts a local notification. |
| Session fork | Reads the focused terminal via `hc`, local Codex SQLite thread IDs or Claude per-process session metadata; launches a new agent process with an explicit conversation ID. On remote spaces these commands execute there. |
| GitHub / Issues panels | Run the user's `gh` CLI in the focused repository (on its machine for remote spaces). The GitHub panel only reads. The Issues panel reads issues, labels and the login, and after explicit user actions creates, edits, comments on, closes or reopens issues, changes labels and assigns or unassigns the user. Nothing runs in the background except list refreshes. |
| Commit suggestions | Reads local Git status and diffs, including untracked text files. Sends bounded excerpts through the user's Codex CLI/account for an automatic suggested subject, only while the Changes panel is on screen and the window is in front. Uses an ephemeral read-only session without user configuration or hooks. The result fills the message input automatically; only Enter/Commit stages all changes and commits. Remote repositories use manual messages. |
| Claude limits (opt-in) | Runs macOS `security` to read Claude Code's OAuth token from Keychain. Sends that token as an Authorization header only to Anthropic's HTTPS usage endpoint. Prints only limit values or error class names, not tokens. |
| Codex limits (opt-in) | Reads up to 15 recent local session JSONL files for `rate_limits`. No network request. Supports `CODEX_HOME`. |

### On Windows

| Component | Access / side effects |
|---|---|
| Python | Found as `py -3` (else `python`), run in UTF-8 mode. `python3` is not used locally: on Windows it is often the Microsoft Store stub. |
| File manager | `file-ops.py` renames with `os.rename` (refuses an existing name, like `RENAME_EXCL`) and moves items to the Recycle Bin with the Shell's `SHFileOperationW` (undoable). If Windows cannot recycle an item, it asks before deleting it for good. Windows-invalid and reserved names (`CON`, `NUL`, …) are refused. |
| Clipboard, open, reveal | `system.py` reads and writes clipboard text with the Windows API, opens files and links with the default app (`os.startfile`) and shows items in Explorer (`SHOpenFolderAndSelectItems`). It never runs a shell string. Programs and scripts (`.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.lnk`, …) are refused instead of opened; links are limited to `http(s)://`, `vscode://` and `obsidian://`. |
| File editor | "Open in" opens `vscode://file/…` and `obsidian://open?path=…` links. App icons are not converted (neutral badges). |
| Search | Runs `rg` directly (no `sh`/`head`); the first 400 result lines are kept. |
| Session fork | Finds Herdr's core as `hc` or `herdr-core` (PATH, then `%LOCALAPPDATA%\Programs\herdr-core`). npm installs of Claude Code and Codex are accepted when they run as `node.exe`, with Herdr's agent status as the deciding check. |
| Commit suggestions | Same as macOS; the helper reads the diff itself instead of receiving it in argv (Windows limits a command line to 32,767 characters). `codex` is found through PATH (`codex.cmd` for npm installs). |
| Limits | Codex only. The Claude source is not ported to Windows (below). |

### Why Claude limits are macOS-only

The Claude limit source reads Claude Code's OAuth token from the macOS Keychain
and calls Anthropic's usage endpoint with it from this package's script.
Anthropic's [Claude Code legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance)
describes subscription OAuth as meant for Claude Code and Anthropic's own apps,
and says other developers may not collect or intermediate Claude.ai credentials
or session tokens. Running the unmodified Claude Code inside Herdr is ordinary
use; reading its token from another program is not. The Windows port therefore
leaves this source out, and `--with-limits` enables only the local Codex source
there. On macOS it stays opt-in, as before.

There is no project telemetry, external upload endpoint or bundled credential.
Agents launched by the user retain their own normal network behavior. Herdr
itself and other installed mods have their own policies.

Never publish a copy of the complete Herdr home. `data/`, `shared.json`, `view.json`,
receipts, agent settings, session databases, credentials and local limit settings
belong to the installing user. `.gitignore` is a convenience, not a substitute
for reviewing files before publication.


## Limits (opt-in)

Limits are **off by default**. To enable both at install time, add `--with-limits`
to the planned and applied install commands. After installation, alternatively
copy `mods/prodsovet/limits.example.json` to `limits.local.json` in the **installed**
mod folder and set `claude` and/or `codex` to `true`.

Claude reads your own `Claude Code-credentials` Keychain item and uses its OAuth
token only against `https://api.anthropic.com/api/oauth/usage`. Codex reads recent
local session logs under `CODEX_HOME` (default `~/.codex`). This is best-effort,
not a billing source: log values may be stale and provider endpoints/formats may
change. Refresh runs about every three minutes. No account data is shipped.
Remove or disable the local config to stop collection on the next refresh.
