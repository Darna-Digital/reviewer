import {
  branchSlug,
  buildPrompt,
  cleanMessage,
  MAX_DIFF_CHARS,
} from '@reviewer/core/git-message';
import { git } from './exec';

export type CommitAgent = 'claude' | 'codex' | 'opencode' | 'cursor';

/** The app's agent invocations (core `agentCommand`), prompt shell-quoted. */
function agentCommand(agent: CommitAgent, prompt: string): string {
  const quoted = `'${prompt.replace(/\0/g, '').replace(/'/g, "'\\''")}'`;
  switch (agent) {
    case 'claude':
      return `claude -p ${quoted} --output-format text`;
    case 'opencode':
      return `opencode run ${quoted}`;
    case 'codex':
      return `codex exec ${quoted}`;
    case 'cursor':
      return `cursor-agent -p ${quoted}`;
  }
}

/** Drafts a commit message for `paths` with an agent CLI — the app's own prompt. */
export async function draftCommitMessage(
  root: string,
  paths: string[],
  agent: CommitAgent = 'claude',
): Promise<string> {
  const pathspec = paths.length > 0 ? ['--', ...paths] : [];
  const [diff, untracked, branch] = await Promise.all([
    git(root, ['diff', 'HEAD', ...pathspec]).catch(() => ''),
    git(root, [
      'ls-files',
      '--others',
      '--exclude-standard',
      ...pathspec,
    ]).catch(() => ''),
    git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ''),
  ]);
  const newFiles = untracked.split('\n').filter(Boolean);
  if (!diff.trim() && newFiles.length === 0)
    throw new Error('No changes to summarize');

  const truncated =
    diff.length > MAX_DIFF_CHARS
      ? `${diff.slice(0, MAX_DIFF_CHARS)}\n…[diff truncated]`
      : diff;
  const listed = newFiles.length
    ? `\n\nNew untracked files:\n${newFiles.map((file) => `  ${file}`).join('\n')}`
    : '';
  const prompt = buildPrompt(
    `${truncated}${listed}`.trim(),
    branchSlug(branch.trim()),
  );

  const proc = Bun.spawn(
    [process.env['SHELL'] ?? 'sh', '-lc', agentCommand(agent, prompt)],
    {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(
      stderr.trim() || `the ${agent} CLI exited ${code} — is it installed?`,
    );
  }
  const message = cleanMessage(stdout);
  if (!message) throw new Error(`the ${agent} CLI produced no message`);
  return message;
}
