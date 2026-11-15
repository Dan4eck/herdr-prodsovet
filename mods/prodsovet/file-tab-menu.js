import { appearance, fontSize, metric, radius, L } from "./appearance.js";
import { agency, px } from "./agency.js";
// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: customized interface and behavior, 2026. See NOTICE.
import { View, div, svg } from "gpui-kit";
import { v_flex } from "gpui-base";
import { props, theme, run, closeOverlay } from "herdr";
import { newTerminal } from "./filesystem.js";
export default class TabMenu extends View {
  init(_p, cx) { this.h = cx.focus_handle(); this.h.focus(); }
  render() {
    const p = props(), t = theme();
    const list = [[L("Rename", "Переименовать"), () => run("tab.rename", { id: p.target.id }), "pencil"], [L("New terminal", "Новый терминал"), () => newTerminal("tab", p.target.space), "terminal"], [L("Close", "Закрыть"), () => run("tab.close", { id: p.target.id }), "close"]];
    return v_flex().id("file-tab-menu").track_focus(this.h).w_full().p(5).bg(t.popover).text_size(fontSize("tabMenu.body"))
      .children(list.map(([label, action, glyph], i) => div().id(`item-${i}`).h(metric("tabMenu.row")).px(9).gap(9).flex().items_center().rounded(radius(6)).text_color(t.foreground).hover(s => s.bg(t.hover))
        .on_click(() => { closeOverlay(p.overlay); action(); })
        .when(agency(), el => el.child(svg(px(glyph)).size(15).flex_none().text_color(t.muted)))
        .child(label)));
  }
}
