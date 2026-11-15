// SPDX-License-Identifier: Apache-2.0
// Herdr Prodsovet: customized interface and behavior, 2026. See NOTICE.
// Agent characters: animated sprite strips by kind and status, plus the
// one-line status scanner for pane headers.

// One-line versions for pane headers and tabs.
const MINI = {
  working: ["▰▱▱▱▱", "▰▰▱▱▱", "▱▰▰▱▱", "▱▱▰▰▱", "▱▱▱▰▰", "▱▱▱▱▰", "▱▱▱▰▰", "▱▱▰▰▱", "▱▰▰▱▱", "▰▰▱▱▱"],
  blocked: ["▰▰!▰▰", "▱▱!▱▱"],
  done: ["▰▰▰▰▰", "▰▰▰▰▰", "▱▰▰▰▱"],
  idle: ["▱▱▱▱▱"],
};
export function mini(status) {
  const st = MINI[status] ? status : "idle";
  return { frames: MINI[st], ms: { working: 110, blocked: 350, done: 600, idle: 1100 }[st] };
}

// Status words, the site's small caps labels.
export const WORD = { working: "РАБОТАЕТ", blocked: "ЖДЁТ ТЕБЯ", done: "ГОТОВО", idle: "СПИТ" };

// Animated characters (Codex's build.py), as 16-frame horizontal sprite strips.
// Herdr plays an animated WebP only once, so the mod steps the strip itself.
export const ART_FRAMES = 16;
export const ART_KINDS = ["claude", "codex", "gemini", "hermes", "other"];
const ART_ALIAS = { antigravity: "gemini" };
export function artKind(programKey) {
  const k = ART_ALIAS[programKey] ?? programKey;
  return ART_KINDS.includes(k) ? k : "other";
}
export function artPath(programKey, status) {
  const st = ["working", "blocked", "done", "idle"].includes(status) ? status : "idle";
  return `mods/prodsovet/art/creatures/${artKind(programKey)}-${st}.png`;
}
