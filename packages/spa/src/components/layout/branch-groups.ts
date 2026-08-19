/** Split "task/BMB-1" into its first folder and remaining display name. */
export const splitBranchFolder = (name: string): [string | null, string] => {
  const slash = name.indexOf("/");
  if (slash < 0) return [null, name];
  return [name.slice(0, slash), name.slice(slash + 1)];
};

export interface BranchFolderGroup<T> {
  readonly folder: string | null;
  readonly items: ReadonlyArray<T>;
}

/** Group rows by their first path segment, preserving the source order. */
export const groupBranchesByFolder = <T>(
  rows: ReadonlyArray<T>,
  nameOf: (row: T) => string
): ReadonlyArray<BranchFolderGroup<T>> => {
  const groups: Array<{ folder: string | null; items: Array<T> }> = [];
  const index = new Map<string | null, number>();
  for (const row of rows) {
    const [folder] = splitBranchFolder(nameOf(row));
    let at = index.get(folder);
    if (at === undefined) {
      at = groups.length;
      index.set(folder, at);
      groups.push({ folder, items: [] });
    }
    groups[at].items.push(row);
  }
  return groups;
};
