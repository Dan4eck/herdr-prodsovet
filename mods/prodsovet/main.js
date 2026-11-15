// SPDX-License-Identifier: Apache-2.0
// Herdr Prodsovet: customized interface and behavior, 2026. See NOTICE.
// ПродСовет: custom workspace features with the standard Herdr styling.
// One mod, several roles (props.role): brand, agents, pane, status.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, panes, props, run, theme, home, layout, window, shared, setShared, spaces, keys, focused, exec, appHome, closeOverlay, settings, terminals, nextCommand, openOverlay } from "herdr";
import { agentTheme, enabled, styledLayout, withTerminal } from "./palette.js";
import { Agents } from "./agents.js";
import { mini, WORD, artPath, ART_FRAMES } from "./creatures.js";

import { workspace, newTerminal } from "./filesystem.js";
import Tabs from "./file-tabs.js";
import NewMenu from "./file-new-menu.js";
import TabMenu from "./file-tab-menu.js";

const MONO = "JetBrains Mono";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}
function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}
const counts = () => {
  const list = agents();
  return {
    total: list.length,
    working: list.filter((a) => a.status === "working").length,
    blocked: list.filter((a) => a.status === "blocked").length,
    done: list.filter((a) => a.status === "done").length,
  };
};

// ── brand: the stock Herdr logo and name, search, sidebar toggle ──
class Brand {
  button(t, id, icon, action) {
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(15));
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    const mac = window()?.platform === "macos" && !window()?.fullscreen;
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center()
      .border_b(1).border_color(t.border)
      .when(mac && !collapsed, (el) => el.pl(80))
      .when(!collapsed, (el) => el.child(h_flex().flex_1().min_w(0).gap(8).items_center()
        .child(image("frame/welcome/herdr.png").size(20).flex_none().rounded(5))
        .child(v_flex().min_w(0)
          .child(div().text_size(13.5).line_height("17px").font_semibold().text_color(t.foreground).child("Herdr"))
          .child(div().font_semibold().text_size(9.5).line_height("12px").text_color(settings().dark ? "#7d9a72" : "#527148").truncate().child("ProdAdvice")))))
      .when(!collapsed, (el) => el.child(this.button(t, "search", "search", () => run("mod.open", { name: "picker" }))))
      .when(!(collapsed && mac), (el) => el.child(this.button(t, "sidebar-toggle", "sidebar", toggleSidebar)));
  }
}

// Pane header: a one-line creature, standard UI typography, and the folder.
class PaneHead {
  init() { this.hovered = false; }
  button(t, id, icon, command, args) {
    return div().id(id).p(3).rounded(4).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); if (command === "pane.split") { run("pane.focus", { pane: args.pane }); newTerminal(args.direction); } else run(command, args); })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }
  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pt = agentTheme(t, withTerminal(p, terminals()), enabled(layout(), settings().dark));
    const st = p.status;
    const pane = p.pane;
    const m = st ? mini(st) : null;
    return h_flex().id(`ps-head-${pane}`).size_full().px(10).gap(8).items_center().text_size(12)
      .bg(pt.background).border_b(1).border_color(st === "working" ? pt.border : t.border)
      .on_hover((h, cx) => { this.hovered = h; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(m), (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(pt[st] ?? t.dim).frames(m.frames, m.ms)))
      .when(!m, (el) => el.child(div().flex_none().font_family(MONO).text_size(11).text_color(t.dim).child(">_")))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(st) && st !== "idle" && st !== "working", (el) => el.child(div().flex_none().text_size(9).text_color(pt[st] ?? t.dim)
        .when(st === "blocked", (e) => e.loop("opacity", { from: 0.3, to: 1, period: 700 }))
        .child(WORD[st] ?? "")))
      .when(this.hovered, (el) => el
        .child(this.button(t, `ps-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ps-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ps-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ps-x-${pane}`, "close", "pane.close", { pane })));
  }
}

// Status bar: machine, branch, crew counts, and Claude/Codex limits.
const DAYS = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
function resetIn(sec) {
  if (!sec) return "";
  const left = sec * 1000 - Date.now();
  if (left <= 0) return "";
  if (left < 3600e3) return `↻${Math.ceil(left / 60e3)}М`;
  if (left < 24 * 3600e3) return `↻${Math.round(left / 3600e3)}Ч`;
  return `↻${DAYS[new Date(sec * 1000).getDay()]}`;
}
class Status {
  init(_p, cx) {
    this.limits = null;
    this.refresh(cx);
    cx.timer.every(180000, (cx) => this.refresh(cx));
  }
  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec("python3", [`${appHome()}/mods/prodsovet/limits.py`], { timeout: 40000 });
        if (r.code === 0) { this.limits = JSON.parse(r.stdout); cx.notify(); }
      } catch (_e) { /* keep the last numbers */ }
    });
  }
  limit(t, label, src) {
    const parts = [];
    if (!src || src.error) return div().flex_none().text_color(t.dim).child(`${label} —`);
    for (const key of ["5h", "7d"]) {
      const w = src[key];
      if (!w) continue;
      const used = Math.round(w.used);
      const color = used >= 80 ? t.blocked : used >= 50 ? t.foreground : t.muted;
      parts.push(div().flex_none().text_color(color).child(`${key === "5h" ? "5Ч" : "7Д"} ${used}% ${resetIn(w.resets)}`.trim()));
    }
    return h_flex().flex_none().gap(5).items_center().child(div().text_color(t.dim).child(label)).children(parts);
  }
  hint() {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((x) => mod[x.toLowerCase()] ?? x.toUpperCase()).join("");
    return key ? `${key}  КОМАНДЫ` : "КОМАНДЫ";
  }
  // Reconcile only on focus/theme/status changes; no redraw timer.
  syncFrame() {
    const f = focused();
    const p = f?.terminal ? panes().find(x => x.terminal === (f.shown ?? f.terminal)) : null;
    const next = styledLayout(layout(), withTerminal(p, terminals()), settings().dark);
    if (!next) { this.pending = null; return; }
    const signature = JSON.stringify(next);
    if (this.pending === signature) return;
    this.pending = signature;
    try { run("layout.set", { layout: next }); }
    catch (error) { this.pending = null; throw error; }
  }
  render() {
    const t = theme();
    this.syncFrame();
    const space = spaces().find((s) => s.active);
    const c = counts();
    const cell = (text, color) => div().flex_none().text_color(color ?? t.muted).child(text);
    return h_flex().size_full().px(10).gap(10).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(10).text_color(t.muted)
      .child(cell((space?.machine ?? "THIS MAC").toUpperCase()))
      .when(Boolean(space?.branch), (el) => el.child(cell(`⎇ ${space.branch}`)))
      .child(cell(`АГЕНТЫ ${c.total}`))
      .when(c.working > 0, (el) => el.child(cell(`РАБОТАЮТ ${c.working}`, t.working)))
      .when(c.blocked > 0, (el) => el.child(cell(`! ЖДУТ ${c.blocked}`, t.blocked).loop("opacity", { from: 0.35, to: 1, period: 800 })))
      .when(c.done > 0, (el) => el.child(cell(`✓ ГОТОВО ${c.done}`, t.done)))
      .when(Boolean(this.limits?.claude), el => el.child(this.limit(t, "CLAUDE", this.limits.claude)))
      .when(Boolean(this.limits?.codex), el => el.child(this.limit(t, "CODEX", this.limits.codex)))
      .child(div().flex_1().min_w(0))
      .child(div().id("palette").flex_none().text_color(t.dim).hover((s) => s.text_color(t.foreground))
        .on_click(() => run("app.palette")).child(this.hint()));
  }
}

// ── toast: agent notes stay silent (Herdr still plays its sound; the sidebar shows who
// waits). Everything else (errors, logins, failed commands) shows as before, bottom right. ──
const TOAST_DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };
function aboutAgent(n) {
  const args = n.action?.args ?? {};
  const list = agents();
  if (args.pane && list.some((a) => a.pane === args.pane)) return true;
  if (args.terminal && list.some((a) => a.address === args.terminal || a.address.endsWith(`/${args.terminal}`)
    || panes().some((p) => p.terminal === args.terminal && p.pane === a.pane))) return true;
  return /\b(finished|needs you|is done|needs your)\b/i.test(`${n.title ?? ""} ${n.body ?? ""}`);
}
class Toast {
  init() {
    const n = props() ?? {};
    this.silent = aboutAgent(n);
    if (this.silent) closeOverlay(n.overlay);
  }
  render() {
    if (this.silent) return div();
    const t = theme();
    const n = props() ?? {};
    return h_flex().id("toast").size_full().px(18).gap(12).items_center().bg(t.popover).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => { if (n.action?.name) run(n.action.name, n.action.args ?? {}); closeOverlay(n.overlay); })
      .child(n.icon ? image(n.icon).w(18).h(18).flex_none() : div().size(8).rounded(4).flex_none().bg(t[TOAST_DOT[n.level] ?? "accent"]))
      .child(v_flex().flex_1().overflow_hidden()
        .child(div().truncate().font_semibold().text_size(13).text_color(t.foreground).child(n.title ?? ""))
        .when(Boolean(n.body), (el) => el.child(div().truncate().tooltip(n.body).text_size(12).text_color(t.muted).child(n.body ?? ""))));
  }
}

// ── zoo: every creature in every state, for previewing ──
class Zoo {
  init(_p, cx) { this.tick = 0; cx.timer.every(100, (cx) => { this.tick++; cx.notify(); }); }
  render() {
    const t = theme();
    const kinds = ["claude", "codex", "gemini", "hermes", "other"];
    const sts = ["working", "blocked", "done", "idle"];
    return v_flex().p(16).gap(10).bg(t.chrome)
      .children(kinds.map((k) => h_flex().gap(18).items_center()
      .child(div().w(60).text_size(11).text_color(t.dim).child(k.toUpperCase()))
      .children(sts.map((st) => div().size(64).flex_none().relative().overflow_hidden()
        .child(image(artPath(k, st)).absolute().top(0).left(-64 * (this.tick % ART_FRAMES)).w(64 * ART_FRAMES).h(64))))));
  }
}

const ROLES = { tabs: Tabs, "new-menu": NewMenu, "tab-menu": TabMenu, toast: Toast, zoo: Zoo, brand: Brand, agents: Agents, pane: PaneHead, status: Status };

export default class ProdSovet extends View {
  init(p, cx) {
    // Pane headers get {pane, terminal} without a role.
    // The layout's toast gets {title, body, level, overlay} without a role.
    const pr = props() ?? {};
    const role = pr.role ?? (pr.pane ? "pane" : pr.overlay && "title" in pr ? "toast" : "brand");
    this.impl = new (ROLES[role] ?? Brand)();
    this.impl.init?.(p, cx);
    if (role === "status") {
      for (const s of spaces()) workspace(s.id);
      cx.spawn(async cx => { for (;;) {
        const c = await nextCommand(), name = c?.name ?? c?.command ?? c;
        if (name === "new-terminal") newTerminal();
        else if (name === "split-right") newTerminal("right");
        else if (name === "split-down") newTerminal("down");
        else if (name === "new-menu") openOverlay({ mod: "prodsovet", kind: "popup", width: 250, height: 512, props: { role: "new-menu" } });
        cx.notify();
      } });
    }
  }
  render(cx) {
    const f = focused();
    if (f?.terminal && f?.space) {
      const agents = shared("files.agents") ?? {};
      if (agents[f.space] !== f.terminal) setShared("files.agents", { ...agents, [f.space]: f.terminal });
    }
    return this.impl.render(cx);
  }
  async close(cx) {
    await this.impl.close?.(cx);
  }
}
