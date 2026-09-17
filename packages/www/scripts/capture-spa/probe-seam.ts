import { launchBrowser, delay } from "./browser.ts";

const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
});

const read = `(() => {
  const dockSheet = [...document.querySelectorAll(".app-sheet")].find((el) => el.classList.contains("app-page-joined"));
  const header = [...document.querySelectorAll("header")].at(-1);
  return {
    url: location.href,
    header: header?.getBoundingClientRect().toJSON() ?? null,
    expandedDock: dockSheet?.getBoundingClientRect().toJSON() ?? null,
    pageHidden: document.querySelector(".app-page")?.classList.contains("hidden") ?? null,
  };
})()`;

for (const url of [
  "http://localhost:41812/modes/code/history",
  "http://localhost:41812/modes/agent-session",
]) {
  await page.goto(url);
  await delay(5000);
  console.log(url, JSON.stringify(await page.evaluate(read), null, 2));
}
await page.close();
await browser.close();
