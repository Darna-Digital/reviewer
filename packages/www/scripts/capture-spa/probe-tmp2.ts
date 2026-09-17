import { launchBrowser, delay } from "./browser.ts";

const url = process.argv[2] ?? "http://localhost:41812/modes/code/review";
const browser = await launchBrowser();
const page = await browser.openPage({
  width: 1600,
  height: 1000,
  scheme: "dark",
});
await page.goto(url);
await delay(8000);

const spot = await page.evaluate<{ x: number; y: number } | null>(`(() => {
  for (const host of document.querySelectorAll("diffs-container")) {
    const box = host.getBoundingClientRect();
    if (box.top < 0 || box.top > innerHeight - 200 || box.height < 120) continue;
    const shadow = host.shadowRoot;
    if (!shadow) continue;
    for (let offset = 40; offset < Math.min(box.height - 20, 400); offset += 6) {
      const el = shadow.elementFromPoint(box.left + 24, box.top + offset);
      if (el && /^\\d{1,5}$/.test(el.textContent?.trim() ?? "")) return { x: box.left + 24, y: box.top + offset };
    }
  }
  return null;
})()`);
console.log("spot", spot);
if (!spot) throw new Error("no gutter line");
await page.click(spot.x, spot.y);
await delay(1500);

const info = await page.evaluate<unknown>(`(() => {
  const rect = (el) => el ? (({x,width,left,right}) => ({x,width,left,right}))(el.getBoundingClientRect()) : null;
  const deep = (sel) => { const out=[]; const walk=(r)=>{for(const el of r.querySelectorAll("*")){if(el.matches(sel))out.push(el); if(el.shadowRoot)walk(el.shadowRoot);}}; walk(document); return out; };
  const card = deep(".comment-card")[0];
  if (!card) return { card: null, textareas: deep("textarea").map(t=>t.placeholder) };
  const host = card.closest("diffs-container");
  const shadow = host.shadowRoot;
  return {
    host: rect(host),
    gutter: rect(shadow.querySelector("[data-gutter]")),
    numberCells: [...shadow.querySelectorAll("[data-column-number]")].slice(0,2).map(rect),
    line: rect(shadow.querySelector("[data-line]")),
    utility: rect(shadow.querySelector("[data-utility-button]")),
    card: rect(card),
    slot: rect(card.parentElement),
    cardMarginLeft: getComputedStyle(card).marginLeft,
  };
})()`);
console.log(JSON.stringify(info, null, 2));
await page.close();
await browser.close();
