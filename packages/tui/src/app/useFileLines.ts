import * as React from 'react';
import { readRepoFile } from '../repos/repoFiles';
import type { Repos } from '../repos/repos';

/** The lines of `paths` as they stand in the working tree, read once each. */
export function useFileLines(
  repos: Repos,
  paths: string[],
): ReadonlyMap<string, string[]> {
  const [lines, setLines] = React.useState<ReadonlyMap<string, string[]>>(
    new Map(),
  );
  const wanted = paths.join('\0');

  React.useEffect(() => {
    let cancelled = false;
    const missing = wanted.split('\0').filter((p) => p && !lines.has(p));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (path) => {
        const file = await readRepoFile(repos, path);
        return [path, file.binary ? [] : file.text.split('\n')] as const;
      }),
    ).then((read) => {
      if (!cancelled) setLines((all) => new Map([...all, ...read]));
    });
    return () => {
      cancelled = true;
    };
  }, [repos, wanted, lines]);

  return lines;
}
