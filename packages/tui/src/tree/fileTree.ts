import type { FileStatus } from '../git/files';

export interface TreeEntry {
  path: string;
  status?: FileStatus;
}

export interface TreeNode {
  /** The folder's or file's path; folders are keyed by it too. */
  path: string;
  /** For a collapsed chain of folders, `a/b/c`. */
  name: string;
  kind: 'dir' | 'file';
  status?: FileStatus;
  children: TreeNode[];
  /** Every file path at or under this node. */
  files: string[];
  /** Whether anything at or under this node has changes. */
  changed: boolean;
}

export interface TreeRow {
  node: TreeNode;
  depth: number;
  expanded: boolean;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/**
 * Builds a Finder-ordered tree (folders first) and folds chains of folders
 * that hold a single folder into one `a/b/c` row.
 */
export function buildTree(entries: TreeEntry[]): TreeNode[] {
  const root = createDir('', '');
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let dir = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const path = parts.slice(0, i + 1).join('/');
      let next = dir.children.find(
        (child) => child.kind === 'dir' && child.path === path,
      );
      if (!next) {
        next = createDir(path, parts[i]!);
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({
      path: entry.path,
      name: parts.at(-1)!,
      kind: 'file',
      status: entry.status,
      children: [],
      files: [entry.path],
      changed: entry.status !== undefined,
    });
  }
  return root.children.map(finish).sort(byKindThenName);
}

export function flattenTree(
  nodes: TreeNode[],
  isExpanded: (node: TreeNode) => boolean,
  depth = 0,
): TreeRow[] {
  return nodes.flatMap((node) => {
    const expanded = node.kind === 'dir' && isExpanded(node);
    const row: TreeRow = { node, depth, expanded };
    return expanded
      ? [row, ...flattenTree(node.children, isExpanded, depth + 1)]
      : [row];
  });
}

/** Keeps files whose path contains `query`, with their folders. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap((node): TreeNode[] => {
    if (node.kind === 'file')
      return node.path.toLowerCase().includes(needle) ? [node] : [];
    const children = filterTree(node.children, query);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

export function findNode(
  nodes: TreeNode[],
  path: string,
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findNode(node.children, path);
    if (found) return found;
  }
  return undefined;
}

/** Folder paths from the top down to (not including) `path`. */
export function ancestorsOf(path: string): string[] {
  const parts = path.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}

function createDir(path: string, name: string): TreeNode {
  return { path, name, kind: 'dir', children: [], files: [], changed: false };
}

function finish(node: TreeNode): TreeNode {
  if (node.kind === 'file') return node;
  let current = node;
  let name = node.name;
  while (current.children.length === 1 && current.children[0]!.kind === 'dir') {
    current = current.children[0]!;
    name = `${name}/${current.name}`;
  }
  const children = current.children.map(finish).sort(byKindThenName);
  return {
    path: current.path,
    name,
    kind: 'dir',
    children,
    files: children.flatMap((child) => child.files),
    changed: children.some((child) => child.changed),
  };
}

function byKindThenName(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
  return collator.compare(a.name, b.name);
}
