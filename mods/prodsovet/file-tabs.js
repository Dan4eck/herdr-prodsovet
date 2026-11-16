import { appearance, fontSize, metric, radius, L } from "./appearance.js";
import { agency, accentOf, selected as selectedLook, icon } from "./agency.js";
// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: customized interface and behavior, 2026. See NOTICE.
import { checkoutContext, selectProjectTab, nextProjectTab, openSessionMenu } from "./project-context.js";
import { View, div, svg, image } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, setShared, layout, settings } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.scroll = ScrollHandle.new();
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = theme();
    const context = checkoutContext();
    const space = context.space;
    const unified = shared("layout") === "ProdAdvice2";
    const shown = context.tabs;
    const active = shown.findIndex(tab => tab.active);
    const selected = shown[active]?.id;
    if (selected !== this.selected || active !== this.selectedIndex) {
      this.selected = selected;
      this.selectedIndex = active;
      if (active >= 0) this.scroll.scroll_to_item(active);
    }
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(radius(6)).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const automatic = !c.named && (/^\d+$/.test(c.name) || /^tb\d+$/.test(c.name));
      const name = unified && automatic ? (program?.agent ? program.name : L("Terminal", "Терминал")) + ` ${i + 1}` : /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      // Agency: the active tab is filled with its agent's color.
      const own = program?.agent ? accentOf(program, t) : t.muted;
      const deco = agency() && c.active;
      return h_flex().id(`tab-${c.id}`).h(metric("tabs.row")).px(10).gap(7).rounded(radius(7)).items_center().flex_none().text_size(fontSize("tabs.body"))
        // A rename or status dot on this or an earlier tab can push the active one out.
        .when(i <= active, el => el.on_size_change((_size, cx) => { this.scroll.scroll_to_item(active); cx.notify(); }))
        .border(1).border_color(c.active && !deco ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .when(deco, el => selectedLook(el, t, own))
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i && shown[from].owner === c.owner) {
            const owner = context.spaces.find(s => s.id === c.owner);
            run("tab.move", { id: shown[from].id, index: owner.tabs.findIndex(x => x.id === c.id) + 1 });
          } else selectProjectTab(c);
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "prodsovet", kind: "popup", width: 200, props: { role: "tab-menu", tab: "tab", target: { id: c.id, space: c.owner } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(agency() ? accentOf(program, t) : t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(radius(3)).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg(icon("close", "mods/pane/close.svg")).size(agency() ? 15 : 12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    // Panels shown as buttons: those the person enabled whose block this layout has.
    // Agency profiles enable Changes and GitHub once (shared "workspace.panels").
    if (agency() && !shared("prodsovet.panels") && find(root, "github")) {
      setShared("workspace.panels", [...new Set([...(shared("workspace.panels") ?? ["files"]), "changes", "github"])]);
      setShared("prodsovet.panels", 1);
    }
    const enabled = (shared("workspace.panels") ?? ["files", "changes"]).filter((id) => find(root, id));
    this.syncPanel(unified && space ? { ...space, id: context.key } : space, panel, body, enabled);
    const panelButton = (id, label, glyph) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(metric("tabs.button")).px(8).gap(5).flex_none().items_center().rounded(radius(6))
        .text_size(fontSize("tabs.action")).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(glyph).size(agency() ? 15 : 14)).child(label);
    };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) unified ? nextProjectTab(e.delta.y > 0 ? -1 : 1) : run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().track_scroll(this.scroll)
        .on_size_change((_size, cx) => { if (active >= 0) { this.scroll.scroll_to_item(active); cx.notify(); } })
        .children(shown.map(item)))
      .child(button("tab-new", agency() ? svg(icon("plus")).size(15) : "+", () => unified ? openSessionMenu(space) : openOverlay({ mod: "prodsovet", kind: "popup", width: 250, height: 512, props: { role: "new-menu" } })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", L("Files", "Файлы"), icon("file", "mods/files/file.svg"))))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", L("Changes", "Изменения"), icon("changes", "mods/changes/changes.svg"))))
      .when(enabled.includes("github"), el => el.child(panelButton("github", "GitHub", icon("pr", "mods/workspace-chrome/branch.svg"))))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
