import { git } from './exec';

/** Stages exactly `paths` (all changes when empty) and commits them. */
export async function commit(
  root: string,
  message: string,
  paths: string[],
): Promise<string> {
  if (paths.length === 0) {
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-m', message]);
  } else {
    // an unmatched pathspec (a deleted, never-tracked file) is not an error here
    for (const path of paths)
      await git(root, ['add', '-A', '--', path], [0, 128]);
    await git(root, ['commit', '-m', message, '--', ...paths]);
  }
  return (await git(root, ['rev-parse', '--short', 'HEAD'])).trim();
}

/** Pushes, setting the upstream on the first push of a branch. */
export async function push(root: string): Promise<string> {
  const upstream = await git(
    root,
    ['rev-parse', '--abbrev-ref', '@{u}'],
    [0, 128],
  );
  const args = upstream.trim() ? ['push'] : ['push', '-u', 'origin', 'HEAD'];
  return gitOutput(root, args);
}

export function pull(root: string): Promise<string> {
  return gitOutput(root, ['pull', '--no-rebase']);
}

export function fetchAll(root: string): Promise<string> {
  return gitOutput(root, ['fetch', '--all', '--prune']);
}

export function merge(root: string, branch: string): Promise<string> {
  return gitOutput(root, ['merge', branch]);
}

export function rebase(root: string, onto: string): Promise<string> {
  return gitOutput(root, ['rebase', onto]);
}

export function createBranch(
  root: string,
  name: string,
  from?: string,
): Promise<string> {
  return gitOutput(root, ['checkout', '-b', name, ...(from ? [from] : [])]);
}

export function renameBranch(
  root: string,
  from: string,
  to: string,
): Promise<string> {
  return gitOutput(root, ['branch', '-m', from, to]);
}

export function deleteBranch(root: string, name: string): Promise<string> {
  return gitOutput(root, ['branch', '-d', name]);
}

/** Reverts working-tree changes; files new since HEAD are removed. */
export async function discard(root: string, paths: string[]): Promise<void> {
  for (const path of paths) {
    const listed = await git(
      root,
      ['ls-tree', '--name-only', 'HEAD', '--', path],
      [0, 128],
    );
    const inHead = listed.trim() !== '';
    if (inHead) {
      await git(root, ['checkout', 'HEAD', '--', path]);
    } else {
      await git(root, ['reset', '-q', 'HEAD', '--', path], [0, 1, 128]);
      await git(root, ['clean', '-fdq', '--', path]);
    }
  }
}

/** git's stdout and stderr together — the part worth showing as a notice. */
async function gitOutput(root: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const output = `${stdout}${stderr}`.trim();
  if (code !== 0)
    throw new Error(output.split('\n').at(-1) || `git ${args[0]} failed`);
  return output;
}

/** The line of git's output a notice should lead with. */
export function summarize(output: string, fallback: string): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const stat = lines.find((line) => /files? changed/.test(line));
  if (stat)
    return stat
      .replace(/insertions?\(\+\)/, '+')
      .replace(/deletions?\(-\)/, '−');
  if (lines.some((line) => /Already up to date/i.test(line)))
    return 'Already up to date';
  if (lines.some((line) => /Everything up-to-date/i.test(line)))
    return 'Nothing to push';
  return fallback;
}

/**
 * Fetches pull request `number` onto `branch`. An existing branch of that
 * name is only fast-forwarded, never reset — it may hold work of your own.
 */
export async function checkoutPull(
  root: string,
  number: number,
  branch: string,
): Promise<string> {
  await git(root, ['fetch', 'origin', `refs/pull/${number}/head`]);
  const head = (await git(root, ['rev-parse', 'FETCH_HEAD'])).trim();
  const existing = await git(
    root,
    ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
    [0, 1],
  );
  if (!existing.trim())
    return gitOutput(root, ['checkout', '-b', branch, head]);
  await gitOutput(root, ['checkout', branch]);
  return gitOutput(root, ['merge', '--ff-only', head]);
}
