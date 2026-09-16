import { launchBrowser, delay } from "./browser.ts";

const url =
  process.argv[2] ??
  "http://localhost:41812/modes/code/browse?file=packages/spa/src/lib/comment-gutter-css.ts";
const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
  initScript: `localStorage.setItem("reviewer-ui", ${JSON.stringify(
    JSON.stringify({ editMode: "comment", bottomVisible: false, sidebarVisible: true })
  )});`,
});
await page.goto(url);
await delay(7000);

const spot = await page.evaluate<{ x: number; y: number } | null>(`(() => {
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  if (!host) return null;
  const box = host.getBoundingClientRect();
  const shadow = host.shadowRoot;
  for (let offset = 40; offset < Math.min(box.height - 20, 500); offset += 6) {
    const el = shadow.elementFromPoint(box.left + 30, box.top + offset);
    if (el && /^\\d{1,5}$/.test(el.textContent?.trim() ?? "")) return { x: box.left + 30, y: box.top + offset };
  }
  return null;
})()`);
if (!spot) throw new Error("no gutter line");
await page.click(spot.x, spot.y);
await delay(1500);

const info = await page.evaluate<unknown>(`(() => {
  const rect = (el) => el ? (({x,y,width,height,left,right}) => ({x,y,width,height,left,right}))(el.getBoundingClientRect()) : null;
  const deep = (sel) => {
    const seen = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (el.matches(sel)) seen.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return seen;
  };
  const host = [...document.querySelectorAll("diffs-container")].find((h) => h.shadowRoot?.querySelector("pre[data-file]"));
  const shadow = host.shadowRoot;
  const wrapper = host.closest("div.relative");
  const cards = deep(".comment-card");
  const out = {
    cardCount: cards.length,
    textareas: deep("textarea").map((t) => t.placeholder),
    gutterWidthVar: getComputedStyle(wrapper).getPropertyValue("--code-gutter-width"),
    wrapperLeft: wrapper.getBoundingClientRect().left,
    gutter: rect(shadow.querySelector("[data-gutter]")),
    line: rect(shadow.querySelector("[data-line]")),
    utility: rect(shadow.querySelector("[data-utility-button]")),
  };
  const card = cards[0];
  if (card) {
    out.card = rect(card);
    out.cardStyles = (({marginLeft, marginRight, maxWidth}) => ({marginLeft, marginRight, maxWidth}))(getComputedStyle(card));
    const chain = [];
    let el = card.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      chain.push({ tag: el.tagName, cls: String(el.className).slice(0,60), attrs: el.getAttributeNames().join(","), rect: rect(el), padLeft: getComputedStyle(el).paddingLeft, display: getComputedStyle(el).display });
      el = el.parentElement;
    }
    out.chain = chain;
  }
  return out;
})()`);
console.log(JSON.stringify(info, null, 2));
await page.close();
await browser.close();
