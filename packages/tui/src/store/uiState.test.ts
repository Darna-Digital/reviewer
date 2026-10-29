import { describe, expect, test } from 'bun:test';
import { openStore } from './createStore';
import { DEFAULT_UI_STATE, loadUiState, saveUiState } from './uiState';

describe('uiState', () => {
  test('round-trips per repository and falls back to defaults', () => {
    const store = openStore(':memory:');
    expect(loadUiState(store, '/a')).toEqual(DEFAULT_UI_STATE);
    saveUiState(store, '/a', {
      ...DEFAULT_UI_STATE,
      bottomOpen: true,
      commitMessage: 'wip',
    });
    saveUiState(store, '/b', DEFAULT_UI_STATE);
    expect(loadUiState(store, '/a')).toMatchObject({
      bottomOpen: true,
      commitMessage: 'wip',
    });
    expect(loadUiState(store, '/b').bottomOpen).toBe(false);
  });
});
