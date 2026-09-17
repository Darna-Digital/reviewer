import { launchBrowser, delay } from "./browser.ts";

const url =
  "http://localhost:41812/modes/code/browse?file=packages/spa/src/lib/comment-gutter-css.ts";
const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
  initScript: `localStorage.setItem("reviewer-ui", ${JSON.stringify(JSON.stringify({ editMode: "comment", bottomVisible: false, sidebarVisible: true }))});`,
});
await page.goto(url);
await delay(7000);
const spot = await page.evaluate<{ x: number; y: number } | null>(`(() => {
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  const box = host.getBoundingClientRect();
  for (let o = 40; o < 400; o += 6) {
    const el = host.shadowRoot.elementFromPoint(box.left + 30, box.top + o);
    if (el && /^\\d{1,5}$/.test(el.textContent?.trim() ?? "")) return { x: box.left + 30, y: box.top + o };
  }
  return null;
})()`);
await page.click(spot!.x, spot!.y);
await delay(1500);
const info = await page.evaluate<unknown>(`(() => {
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  const shadow = host.shadowRoot;
  const slotEl = shadow.querySelector("slot:not([name])") ?? [...shadow.querySelectorAll("slot")][0];
  const slots = [...shadow.querySelectorAll("slot")].map((s) => ({
    name: s.name,
    assigned: s.assignedNodes().length,
    rect: s.getBoundingClientRect().toJSON(),
  }));
  // walk up from the <slot> that has our card assigned
  const card = [...document.querySelectorAll("[slot]")].find((n) => n.querySelector?.(".comment-card"));
  const target = [...shadow.querySelectorAll("slot")].find((s) => s.assignedNodes().includes(card));
  const describe = (el) => el ? ({
    tag: el.tagName,
    cls: String(el.className).slice(0, 80),
    attrs: el.getAttributeNames().map((a) => a + "=" + el.getAttribute(a)).join(" | ").slice(0, 200),
    rect: (({x,width}) => ({x,width}))(el.getBoundingClientRect()),
    padLeft: getComputedStyle(el).paddingLeft,
    display: getComputedStyle(el).display,
  }) : null;
  const chain = [];
  let el = target;
  for (let i = 0; i < 7 && el; i++) { chain.push(describe(el)); el = el.parentElement; }
  return { slots: slots.slice(0, 6), cardSlotName: card?.getAttribute("slot"), chain };
})()`);
console.log(JSON.stringify(info, null, 2));
await page.close();
await browser.close();
