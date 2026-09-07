// Opens the inline comment composer on a line of the diff. Pierre renders the
// gutter inside its own shadow root, so the line number is found by hit-testing
// rather than by selector — and only in a file that is actually on screen,
// since the pane keeps earlier files mounted above the scroll position.
const onScreen = () =>
  [...document.querySelectorAll("diffs-container")].filter((container) => {
    const box = container.getBoundingClientRect();
    return box.top >= 0 && box.top < innerHeight - 120 && box.height > 120;
  });

const findGutter = () => {
  for (const container of onScreen()) {
    const box = container.getBoundingClientRect();
    const shadow = container.shadowRoot;
    if (!shadow) continue;
    for (
      let offset = 90;
      offset < box.height - 20 && offset < 460;
      offset += 6
    ) {
      const candidate = shadow.elementFromPoint(
        box.left + 24,
        box.top + offset
      );
      const label = candidate?.textContent?.trim() ?? "";
      if (candidate && /^\d{1,5}$/.test(label)) return candidate;
    }
  }
  return null;
};

let gutter = findGutter();
for (let attempt = 0; attempt < 20 && !gutter; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  gutter = findGutter();
}
if (!gutter)
  throw new Error("no line number found in an on-screen diff gutter");

gutter.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true })
);
await new Promise((resolve) => setTimeout(resolve, 600));

if (!document.body.innerHTML.includes("Leave a comment")) {
  throw new Error("clicking the line number did not open the composer");
}
