import { describe, expect, test } from 'bun:test';
import { parseCli } from './cli';

describe('parseCli', () => {
  test('uses INIT_CWD only under a package script', () => {
    const env = { INIT_CWD: '/somewhere' };
    expect(parseCli([], env).path).toBe(process.cwd());
    expect(parseCli([], { ...env, npm_lifecycle_event: 'tui' }).path).toBe(
      '/somewhere',
    );
    expect(
      parseCli(['/explicit'], { ...env, npm_lifecycle_event: 'tui' }).path,
    ).toBe('/explicit');
  });

  test('takes a pull request number, with or without #', () => {
    expect(parseCli(['--pr', '42'], {}).pr).toBe('42');
    expect(parseCli(['--pr', '#42'], {}).pr).toBe('42');
  });

  test('picks the light default theme', () => {
    expect(parseCli(['--light'], {}).themeName).toBe('reviewer-light');
  });
});
