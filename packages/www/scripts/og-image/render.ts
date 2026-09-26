import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CARD = new URL("./card.html", import.meta.url);
const OUTPUT = fileURLToPath(
  new URL("../../public/og-image.png", import.meta.url)
);

const CHROME_CANDIDATES = [
  process.env["CHROME_PATH"],
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const chrome = CHROME_CANDIDATES.find((path) => path && existsSync(path));
if (!chrome) {
  throw new Error("No Chrome found — set CHROME_PATH to a browser binary.");
}

execFileSync(chrome, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1200,630",
  "--virtual-time-budget=3000",
  `--screenshot=${OUTPUT}`,
  CARD.href,
]);

console.log(`Wrote ${OUTPUT}`);
