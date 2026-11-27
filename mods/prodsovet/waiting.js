// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: agents waiting at a start-up question. 2026. See NOTICE.
// Claude Code and Codex report their status to Herdr (OSC 7501) only once they run:
// at a first question (trust this folder, try fullscreen, sign in) they are a plain
// program, so the workshop could not show that they need you. This reads the screen
// of such terminals and recognizes a question waiting for a choice.

// A choice menu or a confirm line near the bottom of the screen.
const ASKS = [
  /\b(?:do you )?trust (?:this|the files in this) folder\b/i,
  /\byes,? i trust\b/i,
  /\benter to (?:confirm|select|continue)\b/i,
  /\benter\s+continue\b.*\besc\b/i,
  /\bpress enter to continue\b/i,
  /^\s*[❯›>]\s*1\.\s+\S/m,
  /\((?:y\/n|yes\/no)\)\s*$/im,
  /\[(?:Y\/n|y\/N)\]\s*$/m,
];
const KINDS = [["codex", /\bcodex\b/i], ["claude", /\bclaude\b/i], ["hermes", /\bhermes\b/i]];

// The program a waiting screen belongs to, by its words or its process name.
export function waitingKind(screen, processName = "") {
  const text = String(screen ?? "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const tail = lines.slice(-18).join("\n");
  if (!tail || !ASKS.some((re) => re.test(tail))) return null;
  // A shell prompt below the question means the program has already exited.
  const last = lines.at(-1) ?? "";
  if (/^(?:PS [A-Za-z]:\\.*>|[\w.-]+@[\w.-]+:.*[$#])\s*$/.test(last)) return null;
  const name = String(processName ?? "").toLowerCase();
  for (const [kind, re] of KINDS) if (re.test(name) || re.test(tail)) return kind;
  return "other";
}
