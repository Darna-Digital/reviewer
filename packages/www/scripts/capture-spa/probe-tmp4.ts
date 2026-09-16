import { launchBrowser, delay } from "./browser.ts";
const url = "http://localhost:41812/modes/code/browse?file=packages/spa/src/lib/comment-gutter-css.ts";
const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600, height: 1000, scheme: "dark",
  initScript: `localStorage.setItem("reviewer-ui", ${JSON.stringify(JSON.stringify({ editMode: "comment", bottomVisible: false, sidebarVisible: true }))});`,
});
await page.goto(url);
await delay(7000);
const info = await page.evaluate<unknown>(`(() => {
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  const shadow = host.shadowRoot;
  const rect = (el) => el ? (({x,width}) => ({x,width}))(el.getBoundingClientRect()) : null;
  const line = shadow.querySelector("[data-line]");
  const content = shadow.querySelector("[data-column-content]") ?? line;
  const cs = getComputedStyle(content);
  // first text glyph position
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let first = null;
  while (walker.nextNode()) { if (walker.currentNode.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(walker.currentNode); first = r.getBoundingClientRect().toJSON(); break; } }
  return {
    hostLeft: rect(host),
    gutter: rect(shadow.querySelector("[data-gutter]")),
    line: rect(line),
    contentTag: content.tagName + " " + content.getAttributeNames().join(","),
    content: rect(content),
    contentPadding: [cs.paddingLeft, cs.paddingRight],
    fontSize: cs.fontSize, fontFamily: cs.fontFamily.slice(0,40),
    firstGlyph: first,
  };
})()`);
console.log(JSON.stringify(info, null, 2));
await page.close();
await browser.close();
