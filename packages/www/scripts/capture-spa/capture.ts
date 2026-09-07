import { capturePage } from "./capture-page.ts";
import type { CaptureBrowser } from "./browser.ts";
import { delay } from "./browser.ts";
import type {
  SpaSnapshotFile,
  SpaSnapshotScheme,
  SpaSnapshotVariant,
} from "../../src/lib/spa-snapshot.ts";

/** `[selector@]dx,dy` — a viewport point, or an offset from an element's corner. */
export interface ClickSpec {
  selector: string | null;
  dx: number;
  dy: number;
}

export interface CaptureConfig {
  name: string;
  url: string;
  selector: string;
  focus: string | null;
  out: string;
  width: number;
  height: number;
  schemes: Array<SpaSnapshotScheme>;
  waitFor: string | null;
  settle: number;
  exclude: Array<string>;
  fonts: "skip" | "inline";
  clicks: Array<ClickSpec>;
  /** localStorage entries seeded before first paint; objects are stringified. */
  state: Record<string, unknown>;
  prepare: string | null;
}

const SELECTOR_TIMEOUT_MS = 30_000;
const CLICK_SETTLE_MS = 400;

export function parseClickSpec(spec: string): ClickSpec {
  const [head, point] = spec.includes("@") ? spec.split("@") : [null, spec];
  const [dx, dy] = (point ?? "").split(",").map(Number);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new Error(`Could not read --click ${spec} (expected [selector@]x,y)`);
  }
  return { selector: head, dx, dy };
}

/** The app reads its stored state before first paint, so seed it pre-navigation. */
function initScript(config: CaptureConfig, scheme: SpaSnapshotScheme) {
  const ui = config.state["reviewer-ui"];
  const entries = Object.entries({
    ...config.state,
    "reviewer-theme": scheme,
    "reviewer-ui": {
      ...(typeof ui === "string" ? JSON.parse(ui) : (ui ?? {})),
      translucency: false,
    },
  }).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value),
  ]);
  return `try {
  for (const [key, value] of ${JSON.stringify(entries)}) {
    localStorage.setItem(key, value);
  }
} catch {}`;
}

export async function captureSnapshot(
  browser: CaptureBrowser,
  config: CaptureConfig,
  onVariant?: (scheme: SpaSnapshotScheme, variant: SpaSnapshotVariant) => void
): Promise<SpaSnapshotFile> {
  const variants = {} as Record<SpaSnapshotScheme, SpaSnapshotVariant>;

  for (const scheme of config.schemes) {
    const page = await browser.openPage({
      width: config.width,
      height: config.height,
      scheme,
      initScript: initScript(config, scheme),
    });
    try {
      await page.goto(config.url);
      await page.waitForSelector(config.selector, SELECTOR_TIMEOUT_MS);
      if (config.waitFor) {
        await page.waitForSelector(config.waitFor, SELECTOR_TIMEOUT_MS);
      }
      // Settle before interacting: a selector can match while the pane behind
      // it is still laying out, and a click into empty space finds nothing.
      await delay(config.settle);
      if (config.prepare) {
        await page.evaluate(`(async () => {${config.prepare}})()`);
      }

      for (const click of config.clicks) {
        const origin = click.selector
          ? await page.elementOrigin(click.selector)
          : { x: 0, y: 0 };
        if (!origin) {
          throw new Error(`Nothing matched --click selector ${click.selector}`);
        }
        await page.click(origin.x + click.dx, origin.y + click.dy);
        await delay(CLICK_SETTLE_MS);
      }

      const variant = await page.evaluate<SpaSnapshotVariant>(
        `(${capturePage.toString()})(${JSON.stringify({
          selector: config.selector,
          focus: config.focus,
          exclude: config.exclude,
          width: config.width,
          height: config.height,
          fonts: config.fonts,
          inlineAssetMaxBytes: 512 * 1024,
        })})`
      );
      variants[scheme] = variant;
      onVariant?.(scheme, variant);
    } finally {
      await page.close();
    }
  }

  return {
    url: config.url,
    selector: config.selector,
    capturedAt: new Date().toISOString(),
    variants,
  };
}
