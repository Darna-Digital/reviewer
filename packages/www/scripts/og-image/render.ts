import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The social cards, one per section, written to public/og/<name>.png at
 * 1200×630. `site` is the default every page without its own card uses.
 * Headlines match each page's hero.
 */
const CARDS: Record<string, Record<string, unknown>> = {
  site: {
    title: "Focused system for building software with agents",
    shot: "screenshots/split-diff-light.avif",
  },
  mac: {
    title: "Native Mac app for reviewing agent code",
    shot: "screenshots/split-diff-dark.avif",
  },
  terminal: {
    title: "Review your agent's changes without leaving the terminal",
    shot: "screenshots/tui-hero-light.avif",
  },
  cloud: {
    muted: "Reviewer Cloud",
    title: "is what we're building next.",
    sky: "cloud/sky-light.avif",
  },
  changelog: {
    title: "Changelog",
    shot: "screenshots/tui-history-light.avif",
  },
  docs: {
    title: "Docs",
    shot: "screenshots/find-symbol-light.avif",
  },
  about: {
    title: "About",
    lede: "Reviewer is an agentic development environment for engineers who deeply care about the quality of their work.",
    signOff: true,
  },
};

const CARD = new URL("./card.html", import.meta.url);
const OUTPUT = new URL("../../public/og/", import.meta.url);

const CHROME_CANDIDATES = [
  process.env["CHROME_PATH"],
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const chrome = CHROME_CANDIDATES.find((path) => path && existsSync(path));
if (!chrome) {
  throw new Error("No Chrome found — set CHROME_PATH to a browser binary.");
}

mkdirSync(OUTPUT, { recursive: true });
for (const [name, card] of Object.entries(CARDS)) {
  const output = fileURLToPath(new URL(`${name}.png`, OUTPUT));
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    "--virtual-time-budget=3000",
    `--screenshot=${output}`,
    `${CARD.href}#${encodeURIComponent(JSON.stringify(card))}`,
  ]);
  console.log(`Wrote ${output}`);
}
