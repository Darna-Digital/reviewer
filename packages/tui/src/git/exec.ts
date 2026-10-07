export class GitError extends Error {
  constructor(
    public readonly args: readonly string[],
    public readonly stderr: string,
  ) {
    super(stderr.trim().split('\n').at(-1) || `git ${args.join(' ')} failed`);
    this.name = 'GitError';
  }
}

/** Neutralises user config that would change the text we parse. */
const BASE_ARGS = ['-c', 'core.quotePath=false', '-c', 'color.ui=never'];

/** Field separator for `--format` strings. */
export const US = '\x1f';

/**
 * Runs git in `cwd` and resolves with stdout.
 * @param ok exit codes that are not failures
 */
export async function git(
  cwd: string,
  args: readonly string[],
  ok: readonly number[] = [0],
): Promise<string> {
  const proc = Bun.spawn(['git', ...BASE_ARGS, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (!ok.includes(code)) throw new GitError(args, stderr);
  return stdout;
}

/** Whether `ref` names a commit. */
export async function resolves(cwd: string, ref: string): Promise<boolean> {
  const out = await git(
    cwd,
    ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
    [0, 1],
  );
  return out.trim().length > 0;
}
