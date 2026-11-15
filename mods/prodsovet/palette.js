import { appearance, profileName, allProfiles } from "./appearance.js";
// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: customized interface and behavior, 2026. See NOTICE.
// Only Codex and Claude receive an almost-black terminal tint.
// Herdr shares pane frames within a tab, so the focused terminal chooses it.
export function paletteFor(agent) {
  const PALETTES = appearance().agentPalettes;
  const names = [agent?.program?.key, agent?.app, agent?.program?.name, agent?.foreground?.name].filter(Boolean).map(s => s.toLowerCase());
  return names.some(s => /^(codex|openai-codex)(\b|$)/.test(s)) ? PALETTES.codex
    : names.some(s => /^claude(\b|$)/.test(s)) ? PALETTES.claude : null;
}
export function withTerminal(agent, all) {
  const id = agent?.terminal ?? agent?.address;
  const terminal = id && all.find(t => t.address === id);
  return terminal ? { ...terminal, ...agent, foreground: terminal.foreground } : agent;
}
export function enabled(tree, dark) {
  const name = typeof tree?.theme === "string" ? tree.theme : tree?.theme?.[dark ? "dark" : "light"];
  return dark && appearance().agentTints && name === profileName();
}
export function agentTheme(t, agent, active) {
  const p = active && paletteFor(agent);
  return p ? { ...t, ...p } : t;
}
function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}
// Release the previous revision's global accents; agent colors now stay in terminals.
const OLD_ACCENTS = ["#91abc9", "#c6a084", "#bdb17c", "#a8b3ae"];
const OLD_SELECTIONS = ["#303b49", "#42362e", "#3d3b2b", "#343a3c"];
const OWN_BACKGROUNDS = ["#24282e", "#2b2724", "#2a2923", "#252629", ...Object.values(allProfiles).flatMap(p => Object.values(p.agentPalettes).map(a => a.background))];
export function styledLayout(tree, agent, dark) {
  if (!find(tree, "main")?.content?.pane) return null;
  const next = JSON.parse(JSON.stringify(tree));
  const pane = find(next, "main").content.pane;
  for (const key of ["accent", "working", "cursor"]) {
    if (OLD_ACCENTS.includes(next.colors?.[key])) delete next.colors[key];
  }
  if (OLD_SELECTIONS.includes(next.colors?.selection)) delete next.colors.selection;
  if (next.colors && !Object.keys(next.colors).length) delete next.colors;
  const active = enabled(tree, dark);
  const p = active && paletteFor(agent);
  if (p) {
    pane.background = p.background;
    pane.focus = { width: 1, color: agent?.status === "working" ? p.accent : "border" };
    next.terminal_opacity = 0;
  } else if (active || OWN_BACKGROUNDS.includes(pane.background)) {
    pane.background = "background";
    pane.focus = { width: 1, color: active && agent?.status !== "working" ? "border" : "accent" };
    if (next.terminal_opacity === 0) delete next.terminal_opacity;
  }
  return JSON.stringify(next) === JSON.stringify(tree) ? null : next;
}
