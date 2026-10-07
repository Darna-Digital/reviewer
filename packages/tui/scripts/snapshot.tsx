/**
 * Renders the app headlessly, plays input, and writes the frame as HTML.
 *
 *   bun scripts/snapshot.tsx [--repo .] [--size 160x45] [--db file] [--out frame.html] \
 *     [--input "j j c text:hello enter click:40,10 dclick:40,10 wheel:60,20,down drag:30,5,50,5"]
 */
import type { CapturedFrame } from '@opentui/core';
import { testRender } from '@opentui/react/test-utils';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { deriveChromeTokens, loadTheme } from '@reviewer/core/themes';
import { App } from '../src/app/App';
import { WORKTREE } from '../src/app/comparison';
import type { Comparison } from '../src/app/comparison';
import { repoRoot } from '../src/git/repo';
import { createPalette } from '../src/render/palette';
import { openStore } from '../src/store/createStore';

type Setup = Awaited<ReturnType<typeof testRender>>;

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    repo: { type: 'string' },
    size: { type: 'string' },
    input: { type: 'string' },
    out: { type: 'string' },
    theme: { type: 'string' },
    against: { type: 'string' },
    commit: { type: 'string' },
    db: { type: 'string' },
  },
});

const [width = 160, height = 45] = (values.size ?? '160x45')
  .split('x')
  .map(Number);
const root = await repoRoot(resolve(values.repo ?? '.'));
const themeName = values.theme ?? 'reviewer-dark';
const theme = (await loadTheme(themeName))!;
const store = openStore(values.db);
const initial: Comparison = values.commit
  ? { kind: 'commit', sha: values.commit }
  : values.against
    ? { kind: 'branch', against: values.against }
    : WORKTREE;

const setup = await testRender(
  <App
    root={root}
    store={store}
    palette={createPalette(deriveChromeTokens(theme))}
    theme={theme}
    themeName={themeName}
    initial={initial}
  />,
  { width, height },
);

await settle(1500);
for (const step of (values.input ?? '').split(' ').filter(Boolean)) {
  await play(setup, step);
  await settle(250);
}
await settle(800);

await Bun.write(values.out ?? 'snapshot.html', toHtml(setup.captureSpans()));
console.log(setup.captureCharFrame());
setup.renderer.destroy();
store.close();
process.exit(0);

async function settle(ms: number) {
  for (let i = 0; i < ms / 50; i += 1) {
    await Bun.sleep(50);
    await setup.renderOnce();
  }
}

async function play({ mockInput, mockMouse }: Setup, step: string) {
  const [verb, arg = ''] = step.split(/:(.*)/);
  const [x = 0, y = 0, a, b] = arg
    .split(',')
    .map((n) => (Number.isNaN(Number(n)) ? n : Number(n))) as number[];
  switch (verb) {
    case 'text':
      return mockInput.typeText(arg.replace(/_/g, ' '));
    case 'click':
      return mockMouse.click(x, y);
    case 'rclick':
      return mockMouse.click(x, y, 2);
    case 'dclick':
      return mockMouse.doubleClick(x, y);
    case 'wheel':
      return mockMouse.scroll(x, y, (a as unknown as 'up' | 'down') ?? 'down');
    case 'drag':
      return mockMouse.drag(x, y, a!, b!);
    case 'space':
      return mockInput.pressKey(' ');
    case 'enter':
      return mockInput.pressEnter();
    case 'esc':
      return mockInput.pressEscape();
    case 'tab':
      return mockInput.pressTab();
    case 'down':
    case 'up':
      return mockInput.pressArrow(verb);
    default: {
      const [mod, name] = step.includes('+') ? step.split('+') : [null, step];
      return mockInput.pressKey(
        name,
        mod === 'ctrl' ? { ctrl: true } : undefined,
      );
    }
  }
}

function toHtml(frame: CapturedFrame): string {
  const color = (c: { r: number; g: number; b: number; a: number }) =>
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = frame.lines
    .map(
      (line) =>
        `<div class="l">${line.spans
          .map((span) => {
            const weight = span.attributes & 1 ? 'font-weight:700;' : '';
            const style = span.attributes & 4 ? 'font-style:italic;' : '';
            return `<span style="color:${color(span.fg)};background:${color(span.bg)};${weight}${style}">${escape(span.text)}</span>`;
          })
          .join('')}</div>`,
    )
    .join('');
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#000;padding:12px}
.t{font:13px "JetBrains Mono","SF Mono",Menlo,monospace;white-space:pre;display:inline-block}
.l{height:17px;line-height:17px;display:flex}
.l span{display:inline-block;height:17px}
</style><div class="t">${lines}</div>`;
}
