import {
  branchSlug,
  buildPrompt,
  cleanMessage,
  MAX_DIFF_CHARS,
} from '@reviewer/core/git-message';
import { git } from './exec';

export type CommitAgent = 'claude' | 'codex' | 'opencode' | 'cursor';

/** The agents that can draft a message, as the Mac app's composer lists them. */
export const COMMIT_AGENTS: Array<{ id: CommitAgent; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'cursor', label: 'Cursor' },
];

export function agentLabel(agent: CommitAgent): string {
  return COMMIT_AGENTS.find((entry) => entry.id === agent)?.label ?? agent;
}

export function isCommitAgent(value: unknown): value is CommitAgent {
  return COMMIT_AGENTS.some((entry) => entry.id === value);
}

/** The app's agent invocations (core `agentCommand`), prompt shell-quoted. */
function agentCommand(agent: CommitAgent, prompt: string): string {
  const quoted = `'${prompt.replace(/\0/g, '').replace(/'/g, "'\\''")}'`;
  switch (agent) {
    case 'claude':
      return `claude -p ${quoted} --output-format text --model opus --effort low`;
    case 'opencode':
      return `opencode run ${quoted}`;
    case 'codex':
      return `codex exec ${quoted}`;
    case 'cursor':
      return `cursor-agent -p ${quoted}`;
  }
}

/** The files to summarize in one repository; `name` labels its part of a workspace's diff. */
export interface DraftPart {
  root: string;
  name: string;
  paths: string[];
}

/**
 * Drafts one commit message for `parts` with an agent CLI — the app's own
 * prompt; a workspace's repositories each lead their part of the diff.
 */
export async function draftCommitMessage(
  parts: DraftPart[],
  agent: CommitAgent = 'claude',
): Promise<string> {
  const read = await Promise.all(parts.map(readPart));
  const changed = read.filter((part) => part.text.trim());
  if (changed.length === 0) throw new Error('No changes to summarize');
  const labelled = changed.length > 1 || parts.length > 1;
  const changes = changed
    .map((part) =>
      labelled ? `# Repository ${part.name}\n${part.text}` : part.text,
    )
    .join('\n\n');

  const truncated =
    changes.length > MAX_DIFF_CHARS
      ? `${changes.slice(0, MAX_DIFF_CHARS)}\n…[diff truncated]`
      : changes;
  const root = parts[0]!.root;
  const branch = await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(
    () => '',
  );
  const prompt = buildPrompt(truncated.trim(), branchSlug(branch.trim()));

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

/** One repository's diff of `paths` against HEAD, its new files listed after. */
async function readPart(
  part: DraftPart,
): Promise<{ name: string; text: string }> {
  const pathspec = part.paths.length > 0 ? ['--', ...part.paths] : [];
  const [diff, untracked] = await Promise.all([
    git(part.root, ['diff', 'HEAD', ...pathspec]).catch(() => ''),
    git(part.root, [
      'ls-files',
      '--others',
      '--exclude-standard',
      ...pathspec,
    ]).catch(() => ''),
  ]);
  const newFiles = untracked.split('\n').filter(Boolean);
  const listed = newFiles.length
    ? `\n\nNew untracked files:\n${newFiles.map((file) => `  ${file}`).join('\n')}`
    : '';
  return { name: part.name, text: `${diff}${listed}` };
}
