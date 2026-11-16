# Access and data flow

The installer copies files locally and merges selected key bindings. It does not
contact GitHub, change your active layout, install agent hooks or upload data.

| Component | Access / side effects |
|---|---|
| File manager | Lists chosen workspace folders, reads Git metadata, executes Python filesystem operations on selected local paths. Can create, rename, copy, move and send items to macOS Trash after user actions. |
| File editor | Reads/saves selected files through Herdr. Unsaved drafts persist in local mod storage. External editor actions run `open`. |
| Search | Runs `rg` and shell utilities in the workspace. Can open results or send selected text/path to the focused agent via terminal input and clipboard. |
| Clipboard actions | Use `pbcopy`/`pbpaste`; temporary clipboard replacement/restoration is possible when sending text to an agent. |
| Tabs / agents | Read Herdr space/terminal/agent metadata and Git repository identity; persist project associations and fold state locally; user actions can launch terminals/agents or close tabs. Focused agent may change pane styling in this layout. |
| Session fork | Reads the focused terminal via `hc`, local Codex SQLite thread IDs or Claude per-process session metadata; launches a new agent process with an explicit conversation ID. On remote spaces these commands execute there. |
| Commit suggestions | Reads local Git status and diffs, including untracked text files. Sends bounded excerpts through the user's Codex CLI/account for an automatic suggested subject. Uses an ephemeral read-only session without user configuration or hooks. The result fills the message input automatically; only Enter/Commit stages all changes and commits. Remote repositories use manual messages. |
| Claude limits (opt-in) | Runs macOS `security` to read Claude Code's OAuth token from Keychain. Sends that token as an Authorization header only to Anthropic's HTTPS usage endpoint. Prints only limit values or error class names, not tokens. |
| Codex limits (opt-in) | Reads up to 15 recent local session JSONL files for `rate_limits`. No network request. Supports `CODEX_HOME`. |

There is no project telemetry, external upload endpoint or bundled credential.
Agents launched by the user retain their own normal network behavior. Herdr
itself and other installed mods have their own policies.

Never publish a copy of the complete Herdr home. `data/`, `shared.json`, `view.json`,
receipts, agent settings, session databases, credentials and local limit settings
belong to the installing user. `.gitignore` is a convenience, not a substitute
for reviewing files before publication.
