import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_UI_STATE, loadUiState, saveUiState } from './uiState';

describe('uiState', () => {
  test('round-trips per repository and falls back to defaults', () => {
    const path = join(tmpdir(), `tui-state-${Date.now()}.json`);
    expect(loadUiState('/a', path)).toEqual(DEFAULT_UI_STATE);
    saveUiState(
      '/a',
      { ...DEFAULT_UI_STATE, bottomOpen: true, commitMessage: 'wip' },
      path,
    );
    saveUiState('/b', DEFAULT_UI_STATE, path);
    expect(loadUiState('/a', path)).toMatchObject({
      bottomOpen: true,
      commitMessage: 'wip',
    });
    expect(loadUiState('/b', path).bottomOpen).toBe(false);
  });
});
