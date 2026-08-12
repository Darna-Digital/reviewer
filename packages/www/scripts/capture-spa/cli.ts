import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { delay, launchBrowser } from "./browser.ts";
import { capturePage } from "./capture-page.ts";
import type {
  CaptureOptions,
  SpaSnapshotFile,
  SpaSnapshotScheme,
  SpaSnapshotVariant,
} from "../../src/lib/spa-snapshot.ts";

const USAGE = `Capture a live byconvo SPA view as inert DOM + CSS.

Usage
  pnpm capture:spa --url <page> --out <file.json> [options]

Options
  --url        Page to capture            (default http://localhost:41812/)
  --selector   Element to capture         (default .app-frame)
  --out        JSON to write              (default public/spa-snapshots/hero.json)
  --width      Capture viewport width     (default 1600)
  --height     Capture viewport height    (default 1000)
  --scheme     light | dark | both        (default both)
  --wait-for   Extra selector to wait for before capturing
  --settle     Milliseconds to wait after the page settles (default 1500)
  --exclude    Selector to drop from the capture (repeatable)
  --fonts      skip | inline              (default skip — the site ships Inter)
  --state      JSON file of localStorage entries to seed the app's UI state
  --prepare    JS file run in the page (awaited) to set the view up before capture
  --headed     Show the browser while capturing
`;

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:41812/" },
    selector: { type: "string", default: ".app-frame" },
    out: { type: "string", default: "public/spa-snapshots/hero.json" },
    width: { type: "string", default: "1600" },
    height: { type: "string", default: "1000" },
    scheme: { type: "string", default: "both" },
    "wait-for": { type: "string" },
    settle: { type: "string", default: "1500" },
    exclude: { type: "string", multiple: true, default: [] },
    fonts: { type: "string", default: "skip" },
    state: { type: "string" },
    prepare: { type: "string" },
    headed: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const width = Number(values.width);
const height = Number(values.height);
const settle = Number(values.settle);
const schemes: Array<SpaSnapshotScheme> =
  values.scheme === "both"
    ? ["light", "dark"]
    : [values.scheme as SpaSnapshotScheme];
const outFile = resolve(process.cwd(), values.out);

const captureOptions: CaptureOptions = {
  selector: values.selector,
  exclude: values.exclude,
  width,
  height,
  fonts: values.fonts === "inline" ? "inline" : "skip",
  inlineAssetMaxBytes: 512 * 1024,
};

const seededState: Record<string, string> = values.state
  ? JSON.parse(await readFile(resolve(process.cwd(), values.state), "utf8"))
  : {};

const prepareSource = values.prepare
  ? await readFile(resolve(process.cwd(), values.prepare), "utf8")
  : null;

/** The app reads its stored state before first paint, so seed it pre-navigation. */
const initScript = (scheme: SpaSnapshotScheme) => {
  const entries = {
    ...seededState,
    "byconvo-theme": scheme,
    "byconvo-ui": JSON.stringify({
      ...JSON.parse(seededState["byconvo-ui"] ?? "{}"),
      translucency: false,
    }),
  };
  return `try {
  for (const [key, value] of ${JSON.stringify(Object.entries(entries))}) {
    localStorage.setItem(key, value);
  }
} catch {}`;
};

const kb = (value: number) => `${Math.round(value / 1024)}kb`;

const browser = await launchBrowser({ headed: values.headed });
const variants = {} as Record<SpaSnapshotScheme, SpaSnapshotVariant>;

try {
  for (const scheme of schemes) {
    const page = await browser.openPage({
      width,
      height,
      scheme,
      initScript: initScript(scheme),
    });
    await page.goto(values.url);
    await page.waitForSelector(values.selector, 30_000);
    if (values["wait-for"]) {
      await page.waitForSelector(values["wait-for"], 30_000);
    }
    if (prepareSource) {
      await page.evaluate(`(async () => {${prepareSource}})()`);
    }
    await delay(settle);

    const variant = await page.evaluate<SpaSnapshotVariant>(
      `(${capturePage.toString()})(${JSON.stringify(captureOptions)})`
    );
    await page.close();

    variants[scheme] = variant;
    process.stdout.write(
      `${scheme}: ${variant.nodes} nodes, ${kb(variant.html.length)} html, ` +
        `${kb(variant.css.length)} css, ${variant.rootWidth}×${variant.rootHeight}\n`
    );
    for (const warning of variant.warnings) {
      process.stdout.write(`  ! ${warning}\n`);
    }
  }
} finally {
  await browser.close();
}

const payload: SpaSnapshotFile = {
  url: values.url,
  selector: values.selector,
  capturedAt: new Date().toISOString(),
  variants,
};

const json = JSON.stringify(payload);
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${json}\n`);
process.stdout.write(
  `wrote ${relative(process.cwd(), outFile)} (${kb(json.length)})\n`
);
