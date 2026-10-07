import { describe, expect, test } from 'bun:test';
import { openStore } from './createStore';

describe('openStore', () => {
  test('adds, edits and removes comments in the server shape', () => {
    const store = openStore(':memory:');
    const added = store.addComment('/repo', {
      filePath: 'a.ts',
      side: 'additions',
      lineNumber: 3,
      body: 'first',
      author: 'me',
      target: 'worktree',
    });
    expect(added.source).toBe('local');
    expect(store.comments('/repo').map((c) => c.body)).toEqual(['first']);
    expect(store.comments('/elsewhere')).toEqual([]);

    store.updateComment('/repo', added.id, 'edited');
    expect(store.comments('/repo')[0]?.body).toBe('edited');

    store.removeComment('/repo', added.id);
    expect(store.comments('/repo')).toEqual([]);
    store.close();
  });

  test('sets, replaces and clears a branch aim', () => {
    const store = openStore(':memory:');
    expect(store.branchAim('/repo', 'feature')).toBeNull();
    store.setBranchAim('/repo', 'feature', 'main');
    store.setBranchAim('/repo', 'feature', 'develop');
    expect(store.branchAim('/repo', 'feature')).toBe('develop');
    store.setBranchAim('/repo', 'feature', null);
    expect(store.branchAim('/repo', 'feature')).toBeNull();
    store.close();
  });
});
