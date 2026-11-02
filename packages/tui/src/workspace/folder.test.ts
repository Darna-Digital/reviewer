import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SavedWorkspace } from './client';
import { childRepos, workspaceOfFolder } from './folder';

const saved = (name: string, roots: string[]): SavedWorkspace => ({
  id: name,
  name,
  roots,
  createdAt: '2026-01-01T00:00:00.000Z',
  openedAt: null,
});

describe('childRepos', () => {
  test('lists the repositories directly inside, not hidden or plain folders', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'project-'));
    for (const repo of ['web', 'api', '.hidden'])
      mkdirSync(join(folder, repo, '.git'), { recursive: true });
    mkdirSync(join(folder, 'docs'));
    expect(await childRepos(folder)).toEqual([
      join(folder, 'api'),
      join(folder, 'web'),
    ]);
  });
});

describe('workspaceOfFolder', () => {
  const folder = '/code/reviewer-project';
  const inside = [`${folder}/reviewer`, `${folder}/reviewer-cloud`];

  test('recognizes the workspace whose repositories are all in the folder', () => {
    const list = [
      saved('Elsewhere', ['/code/other']),
      saved('Partly', [`${folder}/reviewer`, '/code/other']),
      saved('Reviewer', inside),
    ];
    expect(workspaceOfFolder(folder, list)?.name).toBe('Reviewer');
  });

  test('prefers the one with the most of them, then the latest opened', () => {
    const list = [
      saved('Recent', [`${folder}/reviewer`]),
      saved('Both', inside),
      saved('Older both', inside),
    ];
    expect(workspaceOfFolder(folder, list)?.name).toBe('Both');
  });

  test('a folder name that only prefixes another is not inside', () => {
    expect(
      workspaceOfFolder(folder, [saved('Twin', [`${folder}-2/web`])]),
    ).toBeNull();
  });
});
