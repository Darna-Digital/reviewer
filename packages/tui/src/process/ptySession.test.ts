import { describe, expect, test } from 'bun:test';
import { PtySession } from './ptySession';

const decoder = new TextDecoder();

async function until(check: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await Bun.sleep(20);
}

describe('PtySession', () => {
  test('runs on a terminal and replays scrollback to a late viewer', async () => {
    const session = new PtySession('t', 'test');
    session.start({
      command: 'printf "\\033[32mready\\033[0m\\n"; exit 3',
      cwd: process.cwd(),
      cols: 40,
      rows: 5,
    });
    await until(() => session.status === 'exited');
    expect(session.status).toBe('exited');
    expect(session.exitCode).toBe(3);

    let seen = '';
    session.attach((data) => (seen += decoder.decode(data)));
    expect(seen).toContain('ready');
    expect(seen).toContain('\x1b[32m');
  });

  test('stop ends a long-running process', async () => {
    const session = new PtySession('t2', 'test');
    session.start({
      command: 'sleep 30',
      cwd: process.cwd(),
      cols: 40,
      rows: 5,
    });
    expect(session.status).toBe('running');
    session.stop();
    expect(session.status).toBe('exited');
  });
});
