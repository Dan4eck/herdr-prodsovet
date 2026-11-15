// Generated from mods/my-files/filesystem.js; keep copies identical.
// Shared workspace context and disk operations for the personal Herdr mods.
import { spaces, panes, focused, home, shared, setShared, exec, appHome, run, openOverlay, window, settings } from "herdr";
import { L, style } from "./appearance.js";

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
  if (!cwd || (!s.machine && cwd === home())) {
    // HOME is provisional until a terminal reaches a project. Once found,
    // keep that root stable across tab switches and later shell navigation.
    const all = panes();
    const candidates = s.tabs.flatMap(t => all.filter(p => p.tab === t.id && p.terminal && p.cwd));
    const anchor = candidates.find(p => s.machine || p.cwd !== home());
    cwd = anchor && s.folder && (s.machine || s.folder !== home()) && within(anchor.cwd, s.folder)
      ? s.folder : anchor?.cwd || s.folder || candidates[0]?.cwd || (!s.machine ? home() : null);
    if (cwd && cwd !== roots[s.id]) setShared("files.workspace-roots", { ...roots, [s.id]: cwd });
  }
  return { space: s.id, cwd, on: s.machine ?? null };
}
// What to call a space: its own name when someone named it; otherwise its
// project root (Herdr would name it after its first terminal's folder, which
// turns into "~" once that tab is a shell at home).
export function spaceLabel(s) {
  if (!s || s.named) return s?.name ?? "";
  const root = workspace(s.id).cwd;
  if (!root) return s.name;
  return !s.machine && root === home() ? "~" : basename(root) || s.name;
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
// File icons: Herdr's line icons, or in agency profiles dot-matrix icons
// colored by kind like the page's dashboards. Paths are app-relative.
const KINDS = [
  ["code", /\.(js|mjs|cjs|ts|tsx|jsx|py|rs|go|sh|zsh|rb|swift|kt|java|c|h|cpp|css|scss|html|lua|sql)$/i],
  ["text", /\.(md|mdx|txt|rtf|org|canvas|base)$/i],
  ["data", /\.(json|jsonl|ya?ml|toml|csv|tsv|xml|ini|env|lock|plist)$/i],
  ["media", /\.(png|jpe?g|gif|webp|svg|ico|heic|mp4|mov|webm|mkv|mp3|wav|m4a|ogg|pdf)$/i],
];
const KIND_COLORS = { folder: ["#a6bbff", "#3b55c4"], code: ["#85dee7", "#16707c"], text: ["#cc9bfa", "#7a3fb8"], data: ["#ffad55", "#9a5300"], media: ["#ff8176", "#c4352b"] };
export function fileKind(name, dir) {
  if (dir) return "folder";
  return KINDS.find(([, re]) => re.test(name ?? ""))?.[0] ?? "file";
}
export function kindColor(t, kind) {
  const pick = KIND_COLORS[kind];
  return pick ? pick[settings()?.dark === false ? 1 : 0] : t.muted;
}
export function fileGlyph(t, name, dir) {
  if (!style("agency")) return { path: `mods/my-files/${dir ? "folder" : "file"}.svg`, color: t.muted, size: 14 };
  const kind = fileKind(name, dir);
  return { path: `mods/my-files/px-${kind}.svg`, color: kindColor(t, kind), size: 12 };
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
  try { value = JSON.parse(result.stdout); } catch { throw new Error(result.stderr || L("The operation failed", "Не удалось выполнить операцию")); }
  if (result.code || value.error) throw new Error(value.error || result.stderr);
  return value;
}
export function activeDocuments() {
  const live = new Set(panes().filter(p => p.mod === "file-tab").map(p => p.tab));
  return Object.fromEntries(Object.entries(shared("files.documents") ?? {}).filter(([id]) => live.has(id)));
}
export function assertClean(path, on = null) {
  const dirty = Object.values(activeDocuments()).find(d => d.on === on && within(d.file, path) && (d.dirty || d.saving));
  if (dirty) throw new Error(L(`Save the open file first: ${basename(dirty.file)}`, `Сначала сохраните открытый файл: ${basename(dirty.file)}`));
}
export function isLocked(file) {
  const l = shared("files.operation");
  return Boolean(l && Date.now() - l.at < 610000 && within(file, l.path));
}
export async function operation(target, name) {
  if (target.on) throw new Error(L("File changes work only on this Mac for now", "Изменение файлов пока доступно только на этом Mac"));
  if (window()?.platform !== "macos") throw new Error(L("These operations are set up for macOS", "Эти операции настроены для macOS"));
  const action = target.action, destructive = ["rename", "move", "trash"].includes(action);
  const existing = shared("files.operation");
  if (existing && Date.now() - existing.at < 610000) throw new Error(L("Wait for the previous operation to finish", "Дождитесь завершения предыдущей операции"));
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
  if (!source) throw new Error(L("Copy or cut a file first", "Сначала скопируйте или вырежьте файл"));
  if (source.on !== target.on) throw new Error(L("Copying between machines is not supported yet", "Копирование между машинами пока не поддерживается"));
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
