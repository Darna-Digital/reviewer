import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { workspaces } from './client';
import type { SavedWorkspace } from './client';

const SKIPPED = new Set(['node_modules']);

export interface FolderWorkspace {
  roots: string[];
  /** `null` when no server could keep it. */
  workspace: { id: string; name: string } | null;
}

/**
 * A folder holding repositories, like `reviewer-project`: the saved
 * workspace of them, else a new one named after the folder — or, with no
 * server to keep it, its repositories side by side unsaved. `null` when no
 * repository is in it.
 */
export async function folderWorkspace(
  folder: string,
): Promise<FolderWorkspace | null> {
  const children = await childRepos(folder);
  if (children.length === 0) return null;
  const saved = await workspaces.list().catch(() => null);
  if (saved === null) return { roots: children, workspace: null };
  const known = workspaceOfFolder(folder, saved);
  const knownRoots = known?.roots.filter((root) => existsSync(root)) ?? [];
  if (known && knownRoots.length > 0)
    return { roots: knownRoots, workspace: { id: known.id, name: known.name } };
  const made = await workspaces
    .create(basename(folder), children)
    .catch(() => null);
  return made
    ? { roots: [...made.roots], workspace: { id: made.id, name: made.name } }
    : { roots: children, workspace: null };
}

/** The repositories directly inside `folder`, by name — a project folder of several. */
export async function childRepos(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(
    () => [],
  );
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !SKIPPED.has(entry.name) &&
        existsSync(join(folder, entry.name, '.git')),
    )
    .map((entry) => join(folder, entry.name))
    .sort();
}

/**
 * The saved workspace that is `folder`'s: every repository of it inside the
 * folder, the one with the most of them — the latest opened when two tie,
 * as the server lists them.
 */
export function workspaceOfFolder(
  folder: string,
  saved: readonly SavedWorkspace[],
): SavedWorkspace | null {
  const inside = (root: string) => root.startsWith(`${folder}/`);
  let best: SavedWorkspace | null = null;
  for (const candidate of saved) {
    if (candidate.roots.length === 0 || !candidate.roots.every(inside))
      continue;
    if (!best || candidate.roots.length > best.roots.length) best = candidate;
  }
  return best;
}
