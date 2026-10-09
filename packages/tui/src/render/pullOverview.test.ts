import { describe, expect, test } from 'bun:test';
import { deriveChromeTokens } from '@reviewer/core/themes';
import { pullFixture } from '../github/pullFixture';
import { createPalette } from './palette';
import { pullOverviewLines } from './pullOverview';

const palette = createPalette(deriveChromeTokens({ type: 'dark' }));
const text = (lines: ReturnType<typeof pullOverviewLines>) =>
  lines.map((line) => line.map((seg) => seg.text).join(''));

describe('pullOverviewLines', () => {
  test('heads with the title, branches and size', () => {
    const lines = text(
      pullOverviewLines(palette, pullFixture(), 80, Date.now()),
    );
    expect(lines[0]).toBe('Connect onboarding to the backend  #7');
    expect(lines[2]).toContain('onboarding → main');
    expect(lines[2]).toContain('+10 −2 · 3 files');
  });

  test('says what is missing rather than leaving gaps', () => {
    const lines = text(
      pullOverviewLines(palette, pullFixture(), 80, Date.now()),
    );
    expect(lines).toContain('No checks reported');
    expect(lines).toContain('Reviewers  None');
    expect(lines).toContain('No description provided.');
  });

  test('warns about a conflict and wraps the description', () => {
    const pull = pullFixture({
      mergeable: 'conflicting',
      body: 'word '.repeat(30).trim(),
    });
    const lines = text(pullOverviewLines(palette, pull, 40, Date.now()));
    expect(
      lines.some((line) => line.startsWith('⚠ #7 conflicts with main')),
    ).toBe(true);
    expect(
      lines.filter((line) => line.startsWith('word')).length,
    ).toBeGreaterThan(2);
  });
});
