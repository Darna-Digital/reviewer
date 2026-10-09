import { describe, expect, test } from 'bun:test';
import type { PullRequestInfo } from '@reviewer/core/ports/git-provider';
import { comparisonOf, targetKey } from '../app/comparison';
import { githubCommentId } from './client';
import { pullFixture } from './pullFixture';
import {
  checksState,
  checksTally,
  localBranchForPull,
  mergeBlockedReason,
  mergeCaution,
  sortedChecks,
} from './pullStatus';

const check = (
  name: string,
  state: PullRequestInfo['checks'][number]['state'],
) => ({
  name,
  state,
  url: '',
});

describe('checks', () => {
  test('no checks is no verdict, not a pass', () => {
    expect(checksState(pullFixture())).toBeNull();
    expect(checksTally(pullFixture())).toBeNull();
  });

  test('a failure outweighs everything, then running, then passing', () => {
    const checks = [check('lint', 'success'), check('e2e', 'pending')];
    expect(checksState(pullFixture({ checks }))).toBe('pending');
    const failing = [...checks, check('unit', 'failure')];
    expect(checksState(pullFixture({ checks: failing }))).toBe('failure');
    expect(checksTally(pullFixture({ checks: failing }))).toBe('1/3 failing');
    expect(checksTally(pullFixture({ checks }))).toBe('1/2');
  });

  test('lists failures first', () => {
    const checks = [
      check('a', 'success'),
      check('b', 'neutral'),
      check('c', 'failure'),
    ];
    expect(sortedChecks(pullFixture({ checks })).map((c) => c.name)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});

describe('merging', () => {
  test('a draft or a conflict blocks; failing checks only caution', () => {
    expect(mergeBlockedReason(pullFixture({ draft: true }))).toContain('draft');
    expect(
      mergeBlockedReason(pullFixture({ mergeable: 'conflicting' })),
    ).toContain('conflicts with main');
    const red = pullFixture({ checks: [check('unit', 'failure')] });
    expect(mergeBlockedReason(red)).toBeNull();
    expect(mergeCaution(red)).toBe('1 check is failing');
    expect(mergeCaution(pullFixture({ mergeable: 'unknown' }))).toContain(
      'not worked out',
    );
  });
});

describe('localBranchForPull', () => {
  test('keeps its own branch name unless it came from a fork', () => {
    expect(localBranchForPull(pullFixture())).toBe('onboarding');
    expect(
      localBranchForPull(pullFixture({ fromFork: true, headRef: 'main' })),
    ).toBe('pr-7-main');
    expect(
      localBranchForPull(pullFixture({ fromFork: true, headRef: '..' })),
    ).toBe('pr-7');
  });
});

describe('pull request comparisons', () => {
  test('file comments under the key the server gives them', () => {
    expect(targetKey({ kind: 'pull', number: 7 })).toBe('pr-7');
    expect(comparisonOf('pr-7')).toEqual({ kind: 'pull', number: 7 });
    expect(comparisonOf('pr-x')).toBeNull();
  });

  test('reads GitHub ids back off comment ids', () => {
    const comment = { id: 'gh-123' } as Parameters<typeof githubCommentId>[0];
    expect(githubCommentId(comment)).toBe(123);
  });
});
