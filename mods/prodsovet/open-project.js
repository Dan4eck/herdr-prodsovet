// SPDX-License-Identifier: Apache-2.0
// Choose an explicit machine, folder and first session; reuse an open checkout.
import { View, div } from "gpui-kit";
import { h_flex, v_flex, Input, InputState } from "gpui-base";
import { spaces, machines, knownAgents, pickFolder, exec, run, theme, props, closeOverlay, shared, setShared } from "herdr";
import { workspace } from "./filesystem.js";
import { inspectCheckout, pathKey, leaf } from "./project-model.js";
import { preferredSpace } from "./project-context.js";
import { L, radius } from "./appearance.js";

export default class OpenProject extends View {
  init(_props, cx) {
    this.on = null; this.path = ""; this.choice = "terminal"; this.agents = []; this.busy = false;
    this.input = InputState.new({ value: "", placeholder: L("Absolute project folder", "Полный путь к папке проекта") });
    this.input.on("change", (_e, cx) => { this.path = this.input.value(); this.error = ""; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.handle = cx.focus_handle(); this.handle.focus();
    this.loadAgents(cx);
  }

  loadAgents(cx) {
    const on = this.on, request = this.request = (this.request ?? 0) + 1;
    this.loading = true; this.agents = []; this.choice = "terminal";
    cx.spawn(async cx => {
      let found = [];
      try { found = (await knownAgents({ on })).filter(a => a.installed); } catch {}
      if (this.request !== request) return;
      this.agents = found;
      this.loading = false; cx.notify();
    });
  }

  machine(on, cx) {
    if (this.busy || this.picking || this.on === on) return;
    this.on = on; this.path = ""; this.input.set_value(""); this.error = "";
    this.loadAgents(cx);
    if (on) cx.timer.after(100, () => this.input.focus());
    cx.notify();
  }

  close() { this.closed = true; }

  chooseFolder(cx) {
    if (this.on || this.busy || this.picking || this.closed) return;
    this.picking = true; this.error = ""; cx.notify();
    cx.spawn(async cx => {
      try {
        const path = await pickFolder({ prompt: L("Open project folder", "Открыть папку проекта") });
        if (path && !this.closed) {
          this.path = path; this.input.set_value(path);
          this.picking = false;
          this.submit(cx);
        }
      } catch (e) { this.error = String(e.message ?? e); }
      finally { this.picking = false; cx.notify(); }
    });
  }

  submit(cx) {
    if (this.busy || this.picking || this.closed || (this.loading && this.choice !== "terminal")) return;
    const path = this.path.trim(), on = this.on;
    if (!path.startsWith("/")) { this.error = L("Choose a folder or enter its absolute path.", "Выбери папку или введи полный путь к ней."); cx.notify(); return; }
    const agent = this.agents.find(a => a.key === this.choice);
    if (this.choice !== "terminal" && !agent) return;
    this.busy = true; this.error = ""; cx.notify();
    cx.spawn(async cx => {
      try {
        // cwd is passed separately, never interpolated into shell source.
        const resolved = await exec("pwd", ["-P"], { cwd: path, on, timeout: 8000 });
        if (resolved.code) throw Error(L("This folder cannot be opened on the selected computer.", "Не удалось открыть папку на выбранном компьютере."));
        const cwd = resolved.stdout.trimEnd();
        const meta = await inspectCheckout(exec, cwd, on);
        const folder = meta.root || cwd;
        const cache = { ...(shared("projects.checkouts.v1") ?? {}), [pathKey(on, folder)]: { ...meta, cwd: folder } };
        setShared("projects.checkouts.v1", cache);
        // Resolve uncached roots too, so an existing project is never duplicated
        // just because its sidebar discovery hasn't completed yet.
        const candidates = [];
        for (const s of spaces().filter(s => (s.machine ?? null) === on)) {
          const root = workspace(s.id).cwd;
          const own = cache[pathKey(on, root)] ?? await inspectCheckout(exec, root, on);
          if ((own.root || root) === folder) candidates.push(s);
        }
        if (this.closed) return;
        const existing = preferredSpace(candidates);
        if (existing) run("space.select", { id: existing.id });
        else run("space.new", { name: leaf(folder), folder, machine: on ?? "", tab: agent?.name ?? L("Terminal", "Терминал"), ...(agent ? { argv: agent.run } : {}) });
        closeOverlay(props().overlay);
      } catch (e) { this.error = String(e.message ?? e); }
      this.busy = false; cx.notify();
    });
  }

  render() {
    const t = theme(), p = props();
    const button = (id, text, action, chosen = false, enabled = true) => div().id(id).h(32).px(10).flex_none().flex().items_center().rounded(radius(5))
      .text_size(12).text_color(enabled ? t.foreground : t.dim).border_1().border_color(chosen ? t.accent : t.input).bg(chosen ? t.accent + "18" : t.raised)
      .when(enabled, el => el.cursor_pointer().hover(s => s.bg(t.hover)).on_click(action)).child(text);
    const choices = [{ name: null, layout: "ready" }, ...machines().filter(m => m.name)];
    const agent = this.agents.find(a => a.key === this.choice);
    return v_flex().id("open-project").track_focus(this.handle).w_full().min_h(0).p(18).gap(12).bg(t.popover).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape" && !this.busy && !this.picking) { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(div().text_size(17).font_semibold().child(L("Open project", "Открыть проект")))
      .child(div().text_size(12).text_color(t.dim).child(L("Computer", "Компьютер")))
      .child(h_flex().gap(6).min_w(0).overflow_x_scrollbar().children(choices.map(m => button(`project-machine-${m.name ?? "local"}`, m.name ?? L("This computer", "Этот компьютер"), (_e, cx) => this.machine(m.name, cx), this.on === m.name, !this.busy && !this.picking && m.layout === "ready"))))
      .child(div().text_size(12).text_color(t.dim).child(L("First session in a new project", "Первая сессия нового проекта")))
      .child(h_flex().gap(6).min_w(0).flex_wrap()
        .child(button("project-agent-terminal", L("Terminal", "Терминал"), (_e, cx) => { this.choice = "terminal"; cx.notify(); }, this.choice === "terminal", !this.busy && !this.picking))
        .children(this.agents.map(a => button(`project-agent-${a.key}`, a.name, (_e, cx) => { this.choice = a.key; cx.notify(); }, this.choice === a.key, !this.busy && !this.picking))))
      .when(this.loading, el => el.child(div().text_size(12).text_color(t.dim).child(L("Checking agents…", "Проверяю агентов…"))))
      .when(Boolean(this.on), el => el
        .child(div().text_size(12).text_color(t.dim).child(L(`Folder on ${this.on}`, `Папка на ${this.on}`)))
        .child(Input.new(this.input).w_full().h(36).px(10).border_1().border_color(t.input).bg(t.background)))
      .child(div().text_size(12).text_color(t.dim).child(this.on
        ? L("An already open project will be selected.", "Уже открытый проект будет выбран повторно.")
        : L("Choose a folder in Finder to open the project immediately.", "Выбери папку в Finder — проект откроется сразу.")))
      .when(Boolean(this.error), el => el.child(div().text_size(12).text_color(t.blocked).child(this.error)))
      .child(h_flex().gap(8).justify_end()
        .child(button("project-cancel", L("Cancel", "Отмена"), () => closeOverlay(p.overlay), false, !this.busy && !this.picking))
        .when(!this.on, el => el.child(button("project-browse", this.busy ? L("Opening…", "Открываю…") : L("Choose folder in Finder…", "Выбрать папку в Finder…"), (_e, cx) => this.chooseFolder(cx), true, !this.busy && !this.picking)))
        .when(Boolean(this.on), el => el.child(button("project-open", this.busy ? L("Opening…", "Открываю…") : agent ? L(`Open with ${agent.name}`, `Открыть с ${agent.name}`) : L("Open with terminal", "Открыть с терминалом"), (_e, cx) => this.submit(cx), true, !this.busy && !this.picking && Boolean(this.path.trim()) && (!this.loading || this.choice === "terminal")))));
  }
}
