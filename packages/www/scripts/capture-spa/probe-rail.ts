import { launchBrowser, delay } from "./browser.ts";

const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
});

const read = `(() => {
  const box = (el) => el ? (({x, right, y, bottom}) => ({x, right, y, bottom}))(el.getBoundingClientRect()) : null;
  const rail = document.querySelector(".app-rail");
  const header = [...document.querySelectorAll("header")].find((h) => h.querySelector(".app-sheet"));
  const band = header?.firstElementChild;
  return {
    url: location.href,
    rail: box(rail),
    firstButton: box(rail?.querySelector("a,button")),
    firstBand: box(band),
    firstBandChild: box(band?.firstElementChild),
    strip: (() => { const a = getComputedStyle(rail, "::after"); return { left: a.left, width: a.width, z: a.zIndex }; })(),
  };
})()`;

for (const url of [
  "http://localhost:41812/modes/code/browse",
  "http://localhost:41812/modes/agent-session",
]) {
  await page.goto(url);
  await delay(5000);
  console.log(url, JSON.stringify(await page.evaluate(read), null, 1));
}
await page.close();
await browser.close();
