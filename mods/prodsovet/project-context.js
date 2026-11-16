// SPDX-License-Identifier: Apache-2.0
// One checkout scope for sidebar, tabs, keyboard navigation and project opening.
import { spaces, panes, shared, run, openOverlay } from "herdr";
import { workspace } from "./filesystem.js";
import { pathKey } from "./project-model.js";

export function checkoutIdentity(space) {
  const cwd = workspace(space.id).cwd || space.folder;
  const meta = (shared("projects.checkouts.v1") ?? {})[pathKey(space.machine, cwd)];
  return pathKey(space.machine, meta?.root || cwd);
}

export function preferredSpace(candidates) {
  const all = panes();
  return candidates.find(s => s.active)
    ?? candidates.find(s => s.tabs.some(tab => all.some(p => p.tab === tab.id && p.program?.agent)))
    ?? candidates[0];
}

export function checkoutContext(id) {
  const all = spaces(), active = all.find(s => id ? s.id === id : s.active);
  if (!active) return { space: null, key: null, spaces: [], tabs: [] };
  const key = checkoutIdentity(active);
  const related = shared("layout") === "ProdAdvice2" ? all.filter(s => checkoutIdentity(s) === key) : [active];
  return { space: active, key, spaces: related, tabs: related.flatMap(s => s.tabs.map(t => ({ ...t, active: Boolean(s.active && t.active), owner: s.id }))) };
}

export function selectProjectTab(tab) {
  if (!tab) return;
  if (!spaces().find(s => s.id === tab.owner)?.active) run("space.select", { id: tab.owner });
  run("tab.select", { id: tab.id });
}

export function nextProjectTab(direction) {
  const tabs = checkoutContext().tabs;
  if (!tabs.length) return;
  const at = tabs.findIndex(t => t.active);
  selectProjectTab(tabs[(Math.max(0, at) + direction + tabs.length) % tabs.length]);
}

export function openProjectDialog() {
  openOverlay({ mod: "prodsovet", kind: "dialog", width: 640, height: 572, props: { role: "open-project" } });
}

export function openSessionMenu(space = spaces().find(s => s.active)) {
  if (!space) return openProjectDialog();
  openOverlay({ mod: "prodsovet", kind: "popup", width: 310, height: 540, props: { role: "new-menu", space: space.id } });
}
