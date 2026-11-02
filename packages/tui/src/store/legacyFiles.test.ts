import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './createStore';
import { loadSettings } from './settings';
import { loadUiState } from './uiState';

const dirs: string[] = [];

afterEach(() => {
  delete process.env['REVIEWER_TUI_SETTINGS'];
  delete process.env['REVIEWER_TUI_STATE'];
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

function files(settings: unknown, uiState: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'tui-legacy-'));
  dirs.push(dir);
  const settingsPath = join(dir, 'tui-settings.json');
  const uiStatePath = join(dir, 'tui.json');
  writeFileSync(settingsPath, JSON.stringify(settings));
  writeFileSync(uiStatePath, JSON.stringify(uiState));
  process.env['REVIEWER_TUI_SETTINGS'] = settingsPath;
  process.env['REVIEWER_TUI_STATE'] = uiStatePath;
  return { db: join(dir, 'reviewer.db'), settingsPath };
}

describe('the JSON files the TUI used to keep', () => {
  test('are taken into the database once', () => {
    const { db, settingsPath } = files(
      { appearance: 'dark', fileIcons: false },
      { '/repo': { bottomOpen: true, commitMessage: 'wip' } },
    );
    const store = openStore(db);
    expect(loadSettings(store)).toMatchObject({
      appearance: 'dark',
      fileIcons: false,
    });
    expect(loadUiState(store, '/repo')).toMatchObject({
      bottomOpen: true,
      commitMessage: 'wip',
    });

    writeFileSync(settingsPath, JSON.stringify({ appearance: 'light' }));
    expect(loadSettings(openStore(db)).appearance).toBe('dark');
  });
});
