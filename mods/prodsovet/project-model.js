// SPDX-License-Identifier: Apache-2.0
// Stable checkout identities, independent of terminal cwd, names and agent status.
export const pathKey = (on, path) => JSON.stringify([on ?? null, path]);
export const leaf = path => path?.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || "/";

export async function inspectCheckout(exec, cwd, on, previous) {
  const git = args => exec("git", args, { cwd, on, timeout: 8000 });
  try {
    const [top, common, branch] = await Promise.all([
      git(["rev-parse", "--path-format=absolute", "--show-toplevel"]),
      git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
      git(["symbolic-ref", "--quiet", "--short", "HEAD"]),
    ]);
    if (top.code || common.code) {
      if (/not a git repository/i.test(top.stderr || common.stderr)) return { cwd, on, kind: "folder" };
      return { ...previous, cwd, on, unavailable: true };
    }
    const root = top.stdout.trimEnd(), repo = common.stdout.trimEnd();
    const main = repo.endsWith("/.git") ? repo.slice(0, -5) : repo;
    return { cwd, on, root, repo, main, kind: "git", linked: repo !== `${root}/.git`, branch: branch.code ? "(detached)" : branch.stdout.trim() };
  } catch {
    return { ...previous, cwd, on, unavailable: true };
  }
}

export function projectGroups(entries) {
  const projects = new Map();
  for (const e of entries) {
    const m = e.meta ?? {}, machine = e.space.machine ?? null;
    const key = pathKey(machine, m.repo || e.cwd);
    let group = projects.get(key);
    if (!group) {
      group = { key, machine, name: m.repo ? leaf(m.main) : e.label, main: m.main, checkouts: [] };
      projects.set(key, group);
    }
    const root = m.root || e.cwd;
    let checkout = group.checkouts.find(c => c.root === root);
    if (!checkout) {
      checkout = { key: pathKey(machine, root), root, meta: m, spaces: [], members: [] };
      group.checkouts.push(checkout);
    }
    checkout.spaces.push(e.space);
    checkout.members.push(...e.members);
  }
  for (const p of projects.values()) {
    p.checkouts.sort((a, b) => Number(Boolean(a.meta.linked)) - Number(Boolean(b.meta.linked)));
    for (const c of p.checkouts) c.members.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }
  return [...projects.values()];
}
