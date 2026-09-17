import { launchBrowser, delay } from "./browser.ts";

const fileUrl =
  "http://localhost:41812/modes/code/browse?file=packages/spa/src/lib/display-path.ts";
const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
});

const readState = `(() => {
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  if (host == null) return { fileView: false, url: location.href };
  const wrapper = host.closest("div.relative");
  const rule = [...wrapper.children].find((el) => typeof el.className === "string" && el.className.includes("w-px"));
  return {
    url: location.href,
    fileView: true,
    widthVar: getComputedStyle(wrapper).getPropertyValue("--code-gutter-width"),
    inlineVar: wrapper.style.getPropertyValue("--code-gutter-width"),
    ruleRect: rule?.getBoundingClientRect().toJSON() ?? null,
    gutterRight: host.shadowRoot.querySelector("[data-gutter]")?.getBoundingClientRect().right ?? null,
  };
})()`;

await page.goto(fileUrl);
await delay(6000);
console.log(
  "first load:",
  JSON.stringify(await page.evaluate(readState), null, 2)
);

await page.evaluate<unknown>(`(() => {
  const link = document.querySelector('a[href*="agent-session"]');
  if (link == null) throw new Error("no session-mode link found");
  link.click();
  return true;
})()`);
await delay(3000);
console.log(
  "session mode:",
  JSON.stringify(await page.evaluate(`(() => ({ url: location.href }))()`))
);

await page.evaluate<unknown>(`(() => { history.back(); return true; })()`);
await delay(4000);
console.log(
  "back to code:",
  JSON.stringify(await page.evaluate(readState), null, 2)
);

await page.close();
await browser.close();
