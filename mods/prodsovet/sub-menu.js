// SPDX-License-Identifier: Apache-2.0
// What a sub-agent row in the sidebar tree can do: show, give it a pane of its
// own, send it back under its parent, or stop it. Opened as a popup with
// props { role: "sub-menu", terminal }.
import { View, div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { props, theme, run, closeOverlay, terminals, panes } from "herdr";
import { fontSize, metric, radius, L } from "./appearance.js";
import { px } from "./agency.js";

// The menu's items for a live terminal, as [id, label, icon, action, danger].
export function subAgentItems(address) {
  const all = terminals(), term = all.find(t => t.address === address);
  if (!term) return [];
  const parent = term.parent && all.find(t => t.address === term.parent);
  const kept = panes().some(p => p.terminal === address);
  const keep = place => () => run("terminal.keep", { terminal: address, place });
  return [
    kept
      ? ["show", L("Show", "Показать"), "go", () => run("pane.focus", { terminal: address })]
      : ["peek", L("Peek", "Подсмотреть"), "zoom", () => run("terminal.peek", { terminal: address })],
    ...(kept
      ? (parent ? [["park", L(`Send back to ${parent.name || "parent"}`, `Вернуть под ${parent.name || "родителя"}`), "fold-down", () => run("terminal.park", { terminal: address })]] : [])
      : [
        ["tab", L("Detach to a tab", "Открепить во вкладку"), "layers", keep("tab")],
        ["right", L("Detach to the right", "Открепить справа"), "split-right", keep("right")],
        ["down", L("Detach below", "Открепить снизу"), "split-down", keep("down")],
      ]),
    ["kill", L("Stop agent", "Остановить агента"), "trash", () => run("terminal.kill", { terminal: address }), true],
  ];
}

export default class SubAgentMenu extends View {
  init(_p, cx) { this.h = cx.focus_handle(); this.h.focus(); this.arming = false; }
  render() {
    const p = props(), t = theme();
    const list = subAgentItems(p.terminal);
    const close = () => closeOverlay(p.overlay);
    return v_flex().id("sub-menu").track_focus(this.h).w_full().p(5).bg(t.popover).text_size(fontSize("tabMenu.body"))
      .on_key_down((e, cx) => { if (e.key === "escape") { close(); cx.stop_propagation(); } })
      .when(!list.length, el => el.child(div().px(9).py(6).text_color(t.dim).child(L("This agent has ended.", "Агент уже завершился."))))
      .children(list.map(([id, label, glyph, action, danger]) => {
        // Stopping takes a second click on the same item: no dialog, no accident.
        const armed = danger && this.arming;
        return div().id(`sub-menu-${id}`).h(metric("tabMenu.row")).px(9).gap(9).flex().items_center().rounded(radius(6))
          .when(danger, el => el.mt(4))
          .text_color(danger ? t.blocked : t.foreground)
          .bg(armed ? t.blocked + "22" : t.popover + "00").hover(s => s.bg(danger ? t.blocked + "22" : t.hover))
          .on_click((_e, cx) => {
            if (danger && !this.arming) { this.arming = true; cx.notify(); return; }
            close(); action();
          })
          .child(svg(px(glyph)).size(15).flex_none().text_color(danger ? t.blocked : t.muted))
          .child(armed ? L("Click again to stop", "Нажми ещё раз, чтобы остановить") : label);
      }));
  }
}
