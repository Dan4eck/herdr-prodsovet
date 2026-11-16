// SPDX-License-Identifier: Apache-2.0
// One project tree for ProdAdvice2. Spaces remain independent native workspaces.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, machines, shared, setShared, exec, run, openOverlay, home, window, setAgentOrder } from "herdr";
import { workspace, spaceLabel } from "./filesystem.js";
import { appearance, fontSize, labelFont, L } from "./appearance.js";
import { px, selected, glitchy } from "./agency.js";
import { openProjectDialog, openSessionMenu, preferredSpace } from "./project-context.js";
import { pathKey, leaf, inspectCheckout, projectGroups } from "./project-model.js";

const CACHE = "projects.checkouts.v1";
const FOLDS = "projects.folded.v1";
const ranks = { blocked: 4, done: 3, working: 2, idle: 1 };

export class ProjectTree {
  init(cx) {
    this.cache = shared(CACHE) ?? {};
    this.folded = new Set(shared(FOLDS) ?? []);
    this.pending = new Set();
    this.checked = new Map();
    this.sync(cx);
    cx.timer.every(15000, cx => { if (window().active) this.sync(cx); });
  }

  entries(list = []) {
    return spaces().map(space => {
      const cwd = workspace(space.id).cwd || space.folder;
      return { space, cwd, label: spaceLabel(space), meta: this.cache[pathKey(space.machine, cwd)], members: list.filter(a => a.space === space.id) };
    });
  }

  sync(cx) {
    for (const e of this.entries()) {
      const on = e.space.machine ?? null, key = pathKey(on, e.cwd);
      if (!e.cwd || this.pending.has(key) || Date.now() - (this.checked.get(key) ?? 0) < 60000) continue;
      this.pending.add(key);
      this.checked.set(key, Date.now());
      cx.spawn(async cx => {
        try {
          const next = await inspectCheckout(exec, e.cwd, on, this.cache[key]);
          this.cache[key] = next;
          // Keep identities when a checkout's space closes or its machine goes away.
          const saved = shared(CACHE) ?? {};
          if (JSON.stringify(saved[key]) !== JSON.stringify(next)) setShared(CACHE, { ...saved, [key]: next });
        } finally { this.pending.delete(key); cx.notify(); }
      });
    }
  }

  toggle(key, cx) {
    this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
    setShared(FOLDS, [...this.folded]);
    cx.notify();
  }

  menu(space) {
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 300, props: { tab: "space", target: { id: space.id } } });
  }

  add(space) {
    openSessionMenu(space);
  }

  render(cx, owner, list, withKids, collapsed, t, all) {
    this.sync(cx);
    const entries = this.entries(list);
    // Recover only Herdr's managed path convention, with one unambiguous local
    // repository. Cached Git identity takes precedence; never match arbitrary basenames.
    for (const e of entries) {
      if (e.space.machine || !e.meta?.unavailable || e.meta.repo) continue;
      const prefix = `${home()}/.herdr/worktrees/`;
      if (!e.cwd.startsWith(prefix)) continue;
      const parts = e.cwd.slice(prefix.length).split("/");
      if (parts.length !== 2) continue;
      const candidates = new Map(entries.filter(x => !x.space.machine && x.meta?.repo && !x.meta.linked && leaf(x.meta.main) === parts[0]).map(x => [x.meta.repo, x.meta]));
      if (candidates.size === 1) {
        const main = [...candidates.values()][0];
        e.meta = { ...e.meta, repo: main.repo, main: main.main, root: e.cwd, linked: true, inferred: true };
        const key = pathKey(null, e.cwd);
        this.cache[key] = e.meta;
        setShared(CACHE, { ...(shared(CACHE) ?? {}), [key]: e.meta });
      }
    }
    const projects = projectGroups(entries);
    const ordered = projects.flatMap(p => p.checkouts.flatMap(c => c.members));
    // Hidden descendants stay in navigation after their parent, once each.
    const addresses = ordered.flatMap(a => [a.address, ...owner.tree(all, a.address).map(s => s.t.address)]);
    setAgentOrder([...new Set(addresses)]);
    const index = new Map(ordered.map((a, i) => [a.address, i]));
    const top = members => members.flatMap(a => [a.status, ...owner.tree(all, a.address).map(s => s.t.status)])
      .reduce((best, s) => (ranks[s] ?? 0) > (ranks[best] ?? 0) ? s : best, null);
    const button = (id, icon, hint, act) => div().id(id).size(22).flex_none().flex().items_center().justify_center()
      .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip(hint)
      .on_click((_e, cx) => { cx.stop_propagation(); act(cx); }).child(svg(px(icon)).size(14));
    const head = (id, name, members, active, space, nested, hint, detail) => {
      const folded = this.folded.has(id), status = top(members);
      return h_flex().id(id).h(nested ? 32 : 36).flex_none().gap(5).pl(nested ? 16 : 4).pr(3).items_center()
        .when(active, el => selected(el, t, t.accent)).hover(el => el.bg(t.hover))
        .on_click(() => { if (space) run("space.select", { id: space.id }); })
        .when(Boolean(space), el => el.on_mouse_down("right", () => this.menu(space)))
        .child(button(`${id}-fold`, `chevron-${folded ? "right" : "down"}`, folded ? L("Expand", "Развернуть") : L("Collapse", "Свернуть"), cx => this.toggle(id, cx)))
        .child(svg(px(nested ? "branch" : "folder")).size(14).flex_none().text_color(t.dim))
        .child(div().flex_1().min_w(0).truncate().text_size(fontSize("agents.body")).text_color(t.foreground).tooltip(hint || name).child(name))
        .when(Boolean(detail), el => el.child(div().max_w(70).truncate().text_size(10).text_color(t.dim).child(detail)))
        .when(Boolean(status), el => el.child(owner.status(t, { status }, true)))
        .when(members.length > 0, el => el.child(div().text_size(10).text_color(t.dim).child(String(members.length))))
        .when(Boolean(space), el => el.child(button(`${id}-add`, "plus", L("New session / worktree", "Новая сессия / worktree"), () => this.add(space))));
    };
    const rows = [];
    const machineNames = [...new Set([...projects.map(p => p.machine), ...machines().map(m => m.name)])];
    const showMachines = machineNames.some(Boolean);
    for (const machine of machineNames) {
      const mine = projects.filter(p => p.machine === machine);
      if (showMachines && !collapsed) {
        const state = machines().find(m => m.name === machine)?.layout;
        rows.push(h_flex().id(`projects-machine-${machine ?? "local"}`).h(28).px(8).gap(6).items_center().flex_none().text_size(11).text_color(t.dim)
          .child(div().flex_1().truncate().child(machine ?? L("THIS COMPUTER", "ЭТОТ КОМПЬЮТЕР")))
          .when(machine && state !== "ready", el => el.child(div().child(L("offline", "нет связи")))));
      }
      for (const project of mine) {
        const id = `project-${project.key}`, members = project.checkouts.flatMap(c => c.members);
        const main = project.checkouts.find(c => !c.meta.linked);
        const target = preferredSpace(main?.spaces ?? project.checkouts[0].spaces);
        const active = project.checkouts.some(c => c.spaces.some(s => s.active));
        if (collapsed) {
          rows.push(h_flex().id(id).h(32).flex_none().items_center().justify_center().text_size(12).text_color(t.foreground)
            .when(active, el => selected(el, t, t.accent)).hover(el => el.bg(t.hover)).tooltip(project.name)
            .on_click(() => run("space.select", { id: target.id })).child(project.name.slice(0, 2).toUpperCase()));
          rows.push(...members.flatMap(a => withKids(a, index.get(a.address))));
          continue;
        }
        rows.push(head(id, project.name, members, active, target, false, main?.root || project.main, main?.meta.branch));
        if (this.folded.has(id)) continue;
        for (const c of project.checkouts) {
          const cid = `checkout-${c.key}`, nested = Boolean(c.meta.linked);
          if (nested) rows.push(head(cid, c.meta.branch || leaf(c.root), c.members, c.spaces.some(s => s.active), preferredSpace(c.spaces), true, c.root, "worktree"));
          if (nested && this.folded.has(cid)) continue;
          if (c.meta.unavailable) rows.push(div().pl(nested ? 44 : 34).pb(4).text_size(10).text_color(t.blocked)
            .child(L("Folder unavailable", "Папка недоступна")));
          const content = c.members.flatMap(a => withKids(a, index.get(a.address)));
          rows.push(v_flex().id(`checkout-content-${c.key}`).flex_none().min_w(0).pl(nested ? 16 : 4).children(content));
        }
      }
    }
    return v_flex().size_full().min_h(0).bg(t.chrome)
      .child(h_flex().h(36).px(collapsed ? 4 : 12).flex_none().items_center().gap(6)
        .when(!collapsed, el => el.child(glitchy(() => div().font_family(labelFont() ?? appearance().fonts.ui).text_size(fontSize("files.body")), L("PROJECTS", "ПРОЕКТЫ"), t, { color: t.foreground, at: 40, length: 230 })))
        .child(div().flex_1())
        .when(!collapsed, el => el.child(div().id("project-open-label").text_size(11).text_color(t.dim).cursor_pointer().hover(s => s.text_color(t.foreground)).on_click(openProjectDialog).child(L("Open…", "Открыть…"))))
        .child(button("project-new", "folder-plus", L("Open project…", "Открыть проект…"), openProjectDialog)))
      .child(v_flex().id("project-list").flex_1().min_h(0).px(collapsed ? 0 : 6).pb(12).overflow_y_scrollbar().mode("always").children(rows));
  }
}
