import { appearance, fontSize, metric } from "./appearance.js";
// SPDX-License-Identifier: Apache-2.0
// ProdAdvice for Herdr: customized interface and behavior, 2026. See NOTICE.
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { props, theme, run, closeOverlay } from "herdr";
import { newTerminal } from "./filesystem.js";
export default class TabMenu extends View {
  init(_p, cx) { this.h = cx.focus_handle(); this.h.focus(); }
  render() {
    const p = props(), t = theme();
    const list = [["Переименовать", () => run("tab.rename", { id: p.target.id })], ["Новый терминал", () => newTerminal("tab", p.target.space)], ["Закрыть", () => run("tab.close", { id: p.target.id })]];
    return v_flex().id("file-tab-menu").track_focus(this.h).w_full().p(5).bg(t.popover).text_size(fontSize("tabMenu.body"))
      .children(list.map(([label, action], i) => div().id(`item-${i}`).h(metric("tabMenu.row")).px(9).flex().items_center().rounded(6).text_color(t.foreground).hover(s => s.bg(t.hover))
        .on_click(() => { closeOverlay(p.overlay); action(); }).child(label)));
  }
}
