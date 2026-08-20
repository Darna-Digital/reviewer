/**
 * Relative line numbers in the gutter.
 *
 * `@pierre/diffs` has no hook for rendering a line number, but the gutter is in
 * the shadow root and each row carries its own number twice: as
 * `data-column-number`, which the library reads, and as the text of a
 * `[data-line-number-content]` span, which only the reader does. Rewriting the
 * text alone leaves every interaction the library drives off the attribute
 * exactly as it was — the same trick the diagnostics painter uses.
 *
 * The painter is idempotent and reversible: turning Vim mode off, or moving to a
 * view that never had it, puts the absolute numbers back.
 */
import { codeRootsWithin } from "@/lib/code-root";

/** Marks a row this module has rewritten, so it can be put back. */
const PAINTED = "data-vim-relative";

const NUMBER_SELECTOR = "[data-column-number]";
const CONTENT_SELECTOR = "[data-line-number-content]";

const rowsIn = (container: ParentNode): ReadonlyArray<Element> =>
  codeRootsWithin(container).flatMap((root) => [
    ...root.querySelectorAll(NUMBER_SELECTOR),
  ]);

/**
 * Number every row by its distance from `caretLine` (zero-based), leaving the
 * caret's own row showing where it actually is — which is the pairing Vim calls
 * `number relativenumber`, and the reason the absolute number is still there
 * when you want to jump to it.
 */
export function paintRelativeLines(
  container: ParentNode,
  caretLine: number
): number {
  let painted = 0;
  for (const row of rowsIn(container)) {
    const attribute = row.getAttribute("data-column-number");
    if (attribute === null) continue;
    const oneBased = Number.parseInt(attribute, 10);
    if (!Number.isFinite(oneBased)) continue;
    const content = row.querySelector(CONTENT_SELECTOR);
    if (!(content instanceof HTMLElement)) continue;
    const distance = Math.abs(oneBased - 1 - caretLine);
    const label = distance === 0 ? String(oneBased) : String(distance);
    row.setAttribute(PAINTED, "");
    if (content.textContent !== label) content.textContent = label;
    painted += 1;
  }
  return painted;
}

/** Put the absolute numbers back on every row this module rewrote. */
export function clearRelativeLines(container: ParentNode): void {
  for (const root of codeRootsWithin(container)) {
    for (const row of root.querySelectorAll(`[${PAINTED}]`)) {
      row.removeAttribute(PAINTED);
      const attribute = row.getAttribute("data-column-number");
      const content = row.querySelector(CONTENT_SELECTOR);
      if (attribute === null || !(content instanceof HTMLElement)) continue;
      content.textContent = attribute;
    }
  }
}
