/**
 * Times scrolling a large diff with OpenTUI's test renderer.
 *
 *   bun scripts/bench.tsx --against v0.0.10 [--repo .] [--db file] [--steps 120]
 */
import { testRender } from '@opentui/react/test-utils';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { App } from '../src/app/App';
import { repoRoot } from '../src/git/repo';
import { openStore } from '../src/store/createStore';
import { loadSettings } from '../src/store/settings';
import { resolveLook } from '../src/theme/resolveLook';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    repo: { type: 'string' },
    db: { type: 'string' },
    against: { type: 'string' },
    steps: { type: 'string' },
  },
});

const root = await repoRoot(resolve(values.repo ?? '.'));
const store = openStore(values.db);
const start = { settings: loadSettings(), system: null, terminal: null };
const look = await resolveLook(start);
const setup = await testRender(
  <App
    root={root}
    store={store}
    themeStart={{ ...start, look }}
    initial={
      values.against
        ? { kind: 'branch', against: values.against }
        : { kind: 'worktree' }
    }
  />,
  { width: 180, height: 50 },
);

for (let i = 0; i < 60; i += 1) {
  await Bun.sleep(50);
  await setup.renderOnce();
}
await setup.mockInput.pressKey('2');
await setup.renderOnce();

console.log(setup.captureCharFrame().split('\n').slice(1, 3).join('\n'));
const steps = Number(values.steps ?? 120);
const stalls: number[] = [];
let tick = performance.now();
const monitor = setInterval(() => {
  const now = performance.now();
  if (now - tick > 16) stalls.push(now - tick);
  tick = now;
}, 1);
report('wheel', await time(() => setup.mockMouse.scroll(100, 20, 'down')));
report('j', await time(() => setup.mockInput.pressKey('j')));
report(
  'ctrl+d',
  await time(() => setup.mockInput.pressKey('d', { ctrl: true })),
);

clearInterval(monitor);
console.log(
  `stalls  ${stalls.length} over 16ms, worst ${Math.max(0, ...stalls).toFixed(0)}ms, total ${stalls.reduce((a, b) => a + b, 0).toFixed(0)}ms`,
);
setup.renderer.destroy();
store.close();
process.exit(0);

/**
 * Wall time per step at a 60 Hz cadence: the step, React's commit, the
 * paint, and whatever else held the event loop (highlighting) meanwhile.
 */
async function time(step: () => unknown): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const at = performance.now();
    await step();
    await Bun.sleep(1);
    await setup.renderOnce();
    samples.push(performance.now() - at - 1);
    await Bun.sleep(15);
  }
  return samples;
}

function report(name: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.floor(q * (sorted.length - 1))]!;
  console.log(
    `${name.padEnd(7)} median ${pick(0.5).toFixed(1)}ms  p95 ${pick(0.95).toFixed(1)}ms  max ${pick(1).toFixed(1)}ms`,
  );
}
