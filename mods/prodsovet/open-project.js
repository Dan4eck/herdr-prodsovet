// SPDX-License-Identifier: Apache-2.0
// Choose an explicit machine, folder and first session; reuse an open checkout.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Input, InputState } from "gpui-base";
import { spaces, machines, knownAgents, pickFolder, exec, run, theme, props, closeOverlay, shared, setShared } from "herdr";
import { workspace } from "./filesystem.js";
import { inspectCheckout, pathKey, leaf } from "./project-model.js";
import { preferredSpace } from "./project-context.js";
import { L, radius, appearance, fontSize } from "./appearance.js";
import { px, glitchy } from "./agency.js";
import { mono, tint, stepLabel, kbd, glyph, glyphTile, hasMascot, mascot } from "./project-ui.js";

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


  // ── drawing ──

  machineTile(t, m) {
    const on = this.on === m.name, ready = m.layout === "ready", enabled = ready && !this.busy && !this.picking;
    const state = !m.name ? L("THIS MAC", "ЭТОТ MAC") : ready ? L("REMOTE", "УДАЛЁННЫЙ") : m.layout === "loading" ? L("CONNECTING", "ПОДКЛЮЧАЮ") : L("OFFLINE", "НЕТ СВЯЗИ");
    return h_flex().id(`project-machine-${m.name ?? "local"}`).h(48).flex_1().min_w(170).px(12).gap(10).items_center().rounded(radius(6))
      .border_1().border_color(on ? t.foreground + "70" : t.border).bg(on ? t.foreground + "14" : t.surface)
      .when(enabled && !on, el => el.cursor_pointer().hover(s => s.bg(t.hover).border_color(t.input)))
      .when(enabled, el => el.on_click((_e, cx) => this.machine(m.name, cx)))
      .when(!ready, el => el.opacity(0.5))
      .child(svg(px(m.name ? "server" : "monitor")).size(15).flex_none().text_color(on ? t.foreground : t.muted))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().truncate().text_size(fontSize("agents.body")).text_color(t.foreground).child(m.name ?? L("This computer", "Этот компьютер")))
        .child(div().truncate().font_family(mono()).text_size(10).text_color(ready ? t.dim : t.blocked).child(state)))
      .when(on, el => el.child(svg(px("check")).size(15).flex_none().text_color(t.foreground)));
  }

  sessionTile(t, key, program, name, caption) {
    const on = this.choice === key, color = tint(t, key), enabled = !this.busy && !this.picking;
    return h_flex().id(`project-agent-${key}`).w(145).h(48).flex_none().px(9).gap(9).items_center().rounded(radius(6))
      .border_1().border_color(on ? color + "90" : t.border).bg(on ? color + "1c" : t.surface)
      .when(enabled && !on, el => el.cursor_pointer().hover(s => s.bg(t.hover).border_color(t.input)))
      .when(enabled, el => el.on_click((_e, cx) => { this.choice = key; cx.notify(); }))
      .when(!enabled && !on, el => el.opacity(0.5))
      .child(glyphTile(t, program, 28, on ? color : t.muted))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().truncate().text_size(fontSize("agents.secondary")).text_color(on ? t.foreground : t.muted).when(on, el => el.font_weight(appearance().weights.semibold)).child(name))
        .child(div().truncate().font_family(mono()).text_size(10).text_color(t.dim).child(caption)));
  }

  // The chosen first session, large: its mascot, or its icon in a frame.
  hero(t, agent) {
    const key = agent?.key ?? "terminal", color = tint(t, key);
    if (hasMascot(key)) return div().size(44).flex_none().child(mascot(key, 44));
    return div().size(44).flex_none().relative().flex().items_center().justify_center().rounded(radius(8))
      .bg(color + "14").border_1().border_color(color + "40")
      .child(glyph(agent, 22, color))
      .when(!agent, el => el.child(div().absolute().right(7).bottom(4).font_family(appearance().fonts.mono).text_size(11).text_color(t.foreground).frames(["_", " "], 530)));
  }

  render() {
    const t = theme(), p = props();
    const idle = !this.busy && !this.picking;
    const choices = [{ name: null, layout: "ready" }, ...machines().filter(m => m.name)];
    const agent = this.agents.find(a => a.key === this.choice);
    const where = this.on ?? L("This computer", "Этот компьютер");
    const sessionName = agent?.name ?? L("Terminal", "Терминал");
    const working = text => div().font_family(mono()).text_size(10).text_color(t.dim).frames([`${text}`, `${text}.`, `${text}..`, `${text}...`], 280);
    const canOpen = idle && Boolean(this.path.trim()) && (!this.loading || this.choice === "terminal");

    const folder = this.on
      ? v_flex().gap(6)
        .child(h_flex().gap(6).items_center()
          .child(h_flex().flex_1().min_w(0).h(38).px(10).gap(8).items_center().rounded(radius(6)).border_1().border_color(t.input).bg(t.background)
            .child(svg(px("path")).size(15).flex_none().text_color(t.dim))
            .child(Input.new(this.input).flex_1().min_w(0).h_full().font_family(appearance().fonts.mono).text_size(12)))
          .child(h_flex().id("project-open").h(38).px(14).gap(7).flex_none().items_center().rounded(radius(6))
            .bg(canOpen ? t.solid : t.raised).text_color(canOpen ? t.solid_foreground : t.dim)
            .text_size(fontSize("agents.secondary")).font_weight(appearance().weights.semibold)
            .when(canOpen, el => el.cursor_pointer().hover(s => s.opacity(0.88)).on_click((_e, cx) => this.submit(cx)))
            .child(this.busy ? L("Opening…", "Открываю…") : L("Open", "Открыть"))
            .child(svg(px("go")).size(15).flex_none())))
        .child(div().text_size(11).text_color(t.dim).child(L(`Absolute path on ${this.on}. An already open project is selected, not duplicated.`, `Полный путь на ${this.on}. Уже открытый проект будет выбран, а не продублирован.`)))
      : h_flex().id("project-browse").h(56).px(12).gap(12).items_center().rounded(radius(6))
        .border_1().border_dashed().border_color(this.picking || this.busy ? t.foreground + "70" : t.input).bg(t.background)
        .when(idle, el => el.cursor_pointer().hover(s => s.bg(t.hover).border_color(t.foreground + "70")).on_click((_e, cx) => this.chooseFolder(cx)))
        .child(div().size(32).flex_none().flex().items_center().justify_center().rounded(radius(6)).bg(t.foreground + "12")
          .child(svg(px("folder")).size(15).text_color(t.foreground)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(fontSize("agents.body")).font_weight(appearance().weights.semibold).text_color(t.foreground)
            .child(this.busy ? L("Opening…", "Открываю…") : this.picking ? L("Waiting for Finder…", "Жду Finder…") : L("Choose folder in Finder…", "Выбрать папку в Finder…")))
          .child(div().truncate().text_size(11).text_color(t.dim)
            .child(L(`Opens at once with ${sessionName}. An open project is selected again.`, `Откроется сразу с: ${sessionName}. Открытый проект выберется повторно.`))))
        .child(svg(px("go")).size(15).flex_none().text_color(t.muted));

    return v_flex().id("open-project").track_focus(this.handle).size_full().min_h(0).bg(t.popover).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape" && idle) { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(h_flex().h(46).flex_none().px(20).items_center().border_b(1).border_color(t.border)
        .child(glitchy(() => div().font_family(mono()).text_size(fontSize("files.body")).font_weight(appearance().weights.semibold), L("OPEN PROJECT", "ОТКРЫТЬ ПРОЕКТ"), t, { at: 30, length: 200 }))
        .child(div().flex_1())
        .child(div().id("project-esc").cursor_pointer().on_click(() => { if (idle) closeOverlay(p.overlay); }).child(kbd(t, "Esc"))))
      .child(v_flex().id("open-project-body").flex_1().min_h(0).px(20).pt(16).pb(8).gap(10).overflow_y_scrollbar()
        .child(stepLabel(t, "01", L("COMPUTER", "КОМПЬЮТЕР")))
        .child(h_flex().gap(6).flex_wrap().children(choices.map(m => this.machineTile(t, m))))
        .child(div().h(6).flex_none())
        .child(stepLabel(t, "02", L("FIRST SESSION", "ПЕРВАЯ СЕССИЯ"), this.loading ? working(L("checking", "проверяю")) : null))
        .child(h_flex().gap(6).flex_wrap()
          .child(this.sessionTile(t, "terminal", null, L("Terminal", "Терминал"), L("DEFAULT", "ПО УМОЛЧАНИЮ")))
          .children(this.agents.map(a => this.sessionTile(t, a.key, a, a.name, (a.run?.[0] ?? a.key).split("/").pop()))))
        .child(div().h(6).flex_none())
        .child(stepLabel(t, "03", this.on ? L("FOLDER ON THE SERVER", "ПАПКА НА СЕРВЕРЕ") : L("FOLDER", "ПАПКА")))
        .child(folder)
        .when(Boolean(this.error), el => el.child(h_flex().gap(8).px(10).py(7).items_center().rounded(radius(6)).bg(t.blocked + "18").border_1().border_color(t.blocked + "50")
          .child(div().size(6).flex_none().bg(t.blocked)).child(div().flex_1().min_w(0).text_size(12).text_color(t.blocked).child(this.error)))))
      .child(h_flex().h(72).flex_none().px(20).gap(12).items_center().border_t(1).border_color(t.border).bg(t.chrome)
        .child(this.hero(t, agent))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().truncate().text_size(14).font_weight(appearance().weights.semibold).text_color(t.foreground).child(sessionName))
          .child(h_flex().gap(6).items_center().min_w(0).font_family(mono()).text_size(10).text_color(t.dim)
            .child(svg(px(this.on ? "server" : "monitor")).size(12).flex_none())
            .child(div().truncate().child(where.toUpperCase()))))
        .child(div().id("project-cancel").h(32).px(12).flex().items_center().rounded(radius(6)).text_size(fontSize("agents.secondary"))
          .text_color(idle ? t.muted : t.dim).border_1().border_color(t.border)
          .when(idle, el => el.cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground)).on_click(() => closeOverlay(p.overlay)))
          .child(L("Cancel", "Отмена"))));
  }
}
