// Shared workspace context and disk operations for the personal Herdr mods.
import { spaces, panes, focused, home, shared, setShared, exec, appHome, run, openOverlay, window } from "herdr";

export const basename = p => p?.split("/").filter(Boolean).pop() || "/";
export const parent = p => p?.slice(0, p.lastIndexOf("/")) || "/";
export const join = (p, name) => `${p === "/" ? "" : p}/${name}`;
export const within = (p, root) => p === root || p.startsWith(root === "/" ? "/" : root + "/");
export const fileKey = (file, on = null, space = "") => JSON.stringify([on, space, file]);
export function workspace(id) {
  const s = spaces().find(s => id ? s.id === id : s.active);
  if (!s) return { space: null, cwd: null, on: null };
  const roots = shared("files.workspace-roots") ?? {};
  let cwd = roots[s.id];
  if (!cwd) {
    // Older spaces were created at HOME; the oldest terminal identifies the project.
    const all = panes();
    const candidates = s.tabs.flatMap(t => all.filter(p => p.tab === t.id && p.terminal && p.cwd));
    const anchor = candidates.find(p => s.machine || p.cwd !== home());
    cwd = anchor && s.folder && (s.machine || s.folder !== home()) && within(anchor.cwd, s.folder)
      ? s.folder : anchor?.cwd || s.folder || candidates[0]?.cwd || (!s.machine ? home() : null);
    if (cwd) setShared("files.workspace-roots", { ...roots, [s.id]: cwd });
  }
  return { space: s.id, cwd, on: s.machine ?? null };
}
export function location() {
  const w = workspace(), browsed = (shared("files.browsed") ?? {})[w.space];
  return { ...w, cwd: browsed || w.cwd };
}
export function browse(cwd, space) {
  setShared("files.browsed", { ...(shared("files.browsed") ?? {}), [space]: cwd });
}
export function newTerminal(place = "tab", id, argv, name) {
  const w = workspace(id);
  if (place === "tab") run("tab.new", { ...(w.space ? { space: w.space } : {}), ...(w.cwd ? { folder: w.cwd } : {}), ...(argv ? { argv } : {}), ...(name ? { name } : {}) });
  else run("terminal.open", { folder: w.cwd, place });
}
export function openFile(file, on = null, space = workspace().space) {
  const live = new Set(spaces().flatMap(s => s.tabs.map(t => t.id)));
  const tab = Object.entries(shared("files.documents") ?? {}).find(([id, d]) => live.has(id) && d.file === file && d.on === on && d.space === space && !d.removed)?.[0];
  if (tab) return run("tab.select", { id: tab });
  run("tab.new", { space, folder: workspace(space).cwd, name: basename(file), mod: "file-tab", props: { file, on, space } });
}
export function context(path, dir, on, space, action) {
  return { path, dir, on: on ?? null, space, action };
}
export function showMenu(target) {
  openOverlay({ mod: "my-files", kind: "popup", width: 268, height: 506, props: { role: "menu", target } });
}
export function showDialog(target, action) {
  openOverlay({ mod: "my-files", kind: "dialog", width: 500, height: 272, props: { role: "dialog", target: { ...target, action } } });
}
export async function localOperation(request) {
  const result = await exec("python3", [`${appHome()}/mods/my-files/file-ops.py`, JSON.stringify(request)], { timeout: 600000 });
  let value;
  try { value = JSON.parse(result.stdout); } catch { throw new Error(result.stderr || "Не удалось выполнить операцию"); }
  if (result.code || value.error) throw new Error(value.error || result.stderr);
  return value;
}
export function activeDocuments() {
  const live = new Set(panes().filter(p => p.mod === "file-tab").map(p => p.tab));
  return Object.fromEntries(Object.entries(shared("files.documents") ?? {}).filter(([id]) => live.has(id)));
}
export function assertClean(path, on = null) {
  const dirty = Object.values(activeDocuments()).find(d => d.on === on && within(d.file, path) && (d.dirty || d.saving));
  if (dirty) throw new Error(`Сначала сохраните открытый файл: ${basename(dirty.file)}`);
}
export function isLocked(file) {
  const l = shared("files.operation");
  return Boolean(l && Date.now() - l.at < 610000 && within(file, l.path));
}
export async function operation(target, name) {
  if (target.on) throw new Error("Изменение файлов пока доступно только на этом Mac");
  if (window()?.platform !== "macos") throw new Error("Эти операции настроены для macOS");
  const action = target.action, destructive = ["rename", "move", "trash"].includes(action);
  const existing = shared("files.operation");
  if (existing && Date.now() - existing.at < 610000) throw new Error("Дождитесь завершения предыдущей операции");
  if (destructive) assertClean(target.path);
  setShared("files.operation", { path: target.path, at: Date.now() });
  try {
    const result = await localOperation({ action, path: target.path, name, destination: target.destination });
    if (result.kind === "move" || result.kind === "trash") {
      const docs = activeDocuments();
      for (const [id, d] of Object.entries(docs)) {
        if (d.on || !within(d.file, result.old)) continue;
        docs[id] = result.kind === "trash" ? { ...d, removed: true } : { ...d, file: result.path + d.file.slice(result.old.length) };
        if (result.kind === "move") run("tab.rename", { id, name: basename(docs[id].file) });
      }
      setShared("files.documents", docs);
      // Keep current browser folders valid when their parent is moved or trashed.
      for (const key of ["files.browsed", "files.workspace-roots"]) {
        const map = { ...(shared(key) ?? {}) };
        for (const [id, p] of Object.entries(map)) {
          if (spaces().find(s => s.id === id)?.machine || !within(p, result.old)) continue;
          map[id] = result.kind === "trash" ? parent(result.old) : result.path + p.slice(result.old.length);
        }
        setShared(key, map);
      }
    }
    setShared("files.revision", (shared("files.revision") ?? 0) + 1);
    return result;
  } finally { setShared("files.operation", null); }
}
export function clipboard(target, cut) {
  setShared("files.clipboard", { path: target.path, on: target.on, cut });
}
export async function paste(target, name) {
  const source = shared("files.clipboard");
  if (!source) throw new Error("Сначала скопируйте или вырежьте файл");
  if (source.on !== target.on) throw new Error("Копирование между машинами пока не поддерживается");
  const result = await operation({ ...source, action: source.cut ? "move" : "copy", destination: target.dir ? target.path : parent(target.path) }, name);
  if (source.cut) setShared("files.clipboard", null);
  return result;
}
export async function copyPath(path) {
  const r = await exec("sh", ["-c", 'printf %s "$1" | pbcopy', "copy", path]);
  if (r.code) throw new Error(r.stderr);
}
export async function reveal(path) {
  const r = await exec("open", ["-R", path]);
  if (r.code) throw new Error(r.stderr);
}
