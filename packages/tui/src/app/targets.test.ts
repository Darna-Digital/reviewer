import { describe, expect, test } from 'bun:test';
import type { Branch } from '../git/refs';
import { buildTargetOptions } from './targets';

function branch(name: string, overrides: Partial<Branch> = {}): Branch {
  return {
    name,
    remote: name.includes('/'),
    sha: name,
    current: false,
    upstream: null,
    ahead: 0,
    behind: 0,
    gone: false,
    committedAt: '',
    subject: '',
    ...overrides,
  };
}

describe('buildTargetOptions', () => {
  test('puts likely picks first and leaves them out of the full lists', () => {
    const options = buildTargetOptions({
      branches: [
        branch('feature', { current: true, upstream: 'origin/feature' }),
        branch('main'),
        branch('develop'),
        branch('origin/feature'),
        branch('origin/main'),
      ],
      current: 'feature',
      aim: 'develop',
      defaultBranch: 'origin/main',
      recent: ['main', 'gone-branch'],
    });
    expect(options.map((o) => [o.ref, o.group, o.reasons])).toEqual([
      [null, 'Suggested', []],
      ['develop', 'Suggested', ['target']],
      ['origin/main', 'Suggested', ['default']],
      ['origin/feature', 'Suggested', ['upstream']],
      ['main', 'Suggested', ['recent']],
    ]);
  });
});
