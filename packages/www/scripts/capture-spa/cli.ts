import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { launchBrowser } from "./browser.ts";
import { captureSnapshot, parseClickSpec } from "./capture.ts";
import type { CaptureConfig } from "./capture.ts";
import type { SpaSnapshotScheme } from "../../src/lib/spa-snapshot.ts";

const USAGE = `Capture live reviewer SPA views as inert DOM + CSS.

Usage
  pnpm capture:spa --url <page> --out <file.json> [options]
  pnpm capture:spa --manifest <file.json>          capture a whole set

Options
  --url        Page to capture            (default http://localhost:41812/)
  --selector   Element to capture         (default .app-frame)
  --focus      Element(s) to frame the render on — several frame the box that
               spans them all; the whole --selector subtree is still captured
  --out        JSON to write              (default public/spa-snapshots/hero.json)
  --width      Capture viewport width     (default 1600)
  --height     Capture viewport height    (default 1000)
  --scheme     light | dark | both        (default both)
  --wait-for   Extra selector to wait for before capturing
  --settle     Milliseconds to wait after the page settles (default 1500)
  --exclude    Selector to drop from the capture (repeatable)
  --fonts      skip | inline              (default skip — the site ships Inter)
  --state      JSON file of localStorage entries to seed the app's UI state
  --prepare    TS file run in the page (awaited) to set the view up
  --click      [selector@]x,y — a real click before capturing (repeatable)
  --manifest   JSON file of { defaults, captures } to run in one browser
  --only       With --manifest: capture just this named entry (repeatable)
  --headed     Show the browser while capturing
`;

interface ManifestEntry {
  name?: string;
  url?: string;
  selector?: string;
  focus?: string;
  out?: string;
  width?: number;
  height?: number;
  scheme?: string;
  waitFor?: string;
  settle?: number;
  exclude?: Array<string>;
  fonts?: string;
  clicks?: Array<string>;
  state?: string;
  prepare?: string;
}

interface Manifest {
  defaults?: ManifestEntry;
  captures: Array<ManifestEntry>;
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    selector: { type: "string" },
    focus: { type: "string" },
    out: { type: "string" },
    width: { type: "string" },
    height: { type: "string" },
    scheme: { type: "string" },
    "wait-for": { type: "string" },
    settle: { type: "string" },
    exclude: { type: "string", multiple: true },
    fonts: { type: "string" },
    state: { type: "string" },
    prepare: { type: "string" },
    click: { type: "string", multiple: true },
    manifest: { type: "string" },
    only: { type: "string", multiple: true },
    headed: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

const schemesOf = (scheme: string | undefined): Array<SpaSnapshotScheme> =>
  scheme === undefined || scheme === "both"
    ? ["light", "dark"]
    : [scheme as SpaSnapshotScheme];

async function toConfig(
  entry: ManifestEntry,
  base: string
): Promise<CaptureConfig> {
  const path = (value: string) => resolve(base, value);
  return {
    name: entry.name ?? entry.out ?? "capture",
    url: entry.url ?? "http://localhost:41812/",
    selector: entry.selector ?? ".app-frame",
    focus: entry.focus ?? null,
    out: resolve(process.cwd(), entry.out ?? "public/spa-snapshots/hero.json"),
    width: entry.width ?? 1600,
    height: entry.height ?? 1000,
    schemes: schemesOf(entry.scheme),
    waitFor: entry.waitFor ?? null,
    settle: entry.settle ?? 1500,
    exclude: entry.exclude ?? [],
    fonts: entry.fonts === "inline" ? "inline" : "skip",
    clicks: (entry.clicks ?? []).map(parseClickSpec),
    state: entry.state ? await readJson(path(entry.state)) : {},
    prepare: entry.prepare ? await readFile(path(entry.prepare), "utf8") : null,
  };
}

async function plan(): Promise<Array<CaptureConfig>> {
  if (!values.manifest) {
    const entry: ManifestEntry = {
      name: "capture",
      ...(values.url && { url: values.url }),
      ...(values.selector && { selector: values.selector }),
      ...(values.focus && { focus: values.focus }),
      ...(values.out && { out: values.out }),
      ...(values.width && { width: Number(values.width) }),
      ...(values.height && { height: Number(values.height) }),
      ...(values.scheme && { scheme: values.scheme }),
      ...(values["wait-for"] && { waitFor: values["wait-for"] }),
      ...(values.settle && { settle: Number(values.settle) }),
      ...(values.exclude && { exclude: values.exclude }),
      ...(values.fonts && { fonts: values.fonts }),
      ...(values.click && { clicks: values.click }),
      ...(values.state && { state: values.state }),
      ...(values.prepare && { prepare: values.prepare }),
    };
    return [await toConfig(entry, process.cwd())];
  }

  const manifestPath = resolve(process.cwd(), values.manifest);
  const manifest = await readJson<Manifest>(manifestPath);
  const base = dirname(manifestPath);
  const wanted = values.only;
  return Promise.all(
    manifest.captures
      .filter((entry) => !wanted || wanted.includes(entry.name ?? ""))
      .map((entry) => toConfig({ ...manifest.defaults, ...entry }, base))
  );
}

const configs = await plan();
if (!configs.length) {
  process.stderr.write("Nothing to capture\n");
  process.exit(1);
}

const kb = (value: number) => `${Math.round(value / 1024)}kb`;
const browser = await launchBrowser({ headed: values.headed });

try {
  for (const config of configs) {
    process.stdout.write(`${config.name} ← ${config.url}\n`);
    const payload = await captureSnapshot(
      browser,
      config,
      (scheme, variant) => {
        const framed = variant.focus
          ? ` framed ${variant.focus.width}×${variant.focus.height}`
          : "";
        process.stdout.write(
          `  ${scheme}: ${variant.nodes} nodes, ${kb(variant.html.length)} html, ` +
            `${kb(variant.css.length)} css, ${variant.rootWidth}×${variant.rootHeight}${framed}\n`
        );
        for (const warning of variant.warnings) {
          process.stdout.write(`  ! ${warning}\n`);
        }
      }
    );

    const json = JSON.stringify(payload);
    await mkdir(dirname(config.out), { recursive: true });
    await writeFile(config.out, `${json}\n`);
    process.stdout.write(
      `  wrote ${relative(process.cwd(), config.out)} (${kb(json.length)})\n`
    );
  }
} finally {
  await browser.close();
}
