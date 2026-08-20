/**
 * Folding, in the DOM.
 *
 * `@pierre/diffs` has no API for hiding a range of lines, so folding is painted
 * on the way the diagnostics underlines and the relative line numbers are: the
 * rendered rows live in the view's shadow root, each one carries its own
 * zero-based `data-line-index`, and the gutter cell for a line carries the same.
 * Hiding both halves of a row keeps the two subgrids in step; hiding only one
 * would shear the numbers away from the code.
 *
 * Everything here is idempotent and reversible — the pass runs again after every
 * render and after the virtualiser swaps rows in, and clears its own marks
 * first, so a fold that has been opened cannot leave a hidden line behind.
 */

/** Set on a row the folds are hiding. */
const HIDDEN = "data-fold-hidden";
/** Set on the header row of a region, whether or not it is closed. */
const FOLDABLE = "data-foldable";
/** Set on the header row of a closed region. */
const CLOSED = "data-fold-closed";
/** The chevron this module puts into a foldable line's gutter cell. */
const TOGGLE = "data-fold-toggle";

const MARKED = `[${HIDDEN}], [${FOLDABLE}], [${CLOSED}]`;

/**
 * Rows carry `data-line-index`; annotation rows and gutter buffers do too, so
 * a comment thread on a folded line folds away with it.
 */
const INDEXED = "[data-line-index]";

export const FOLD_CSS = `
[${HIDDEN}] { display: none !important; }

[data-line][${CLOSED}]::after {
  content: "⋯";
  display: inline-block;
  margin-inline-start: 0.5ch;
  padding-inline: 0.5ch;
  border-radius: 3px;
  opacity: 0.75;
  background-color: color-mix(in lab, currentColor 12%, transparent);
  cursor: pointer;
}

[data-column-number][${FOLDABLE}] { position: relative; }

[${TOGGLE}] {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: 1.1ch;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  line-height: 1;
  opacity: 0;
  cursor: pointer;
  user-select: none;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
}
/* The chevron is an affordance, not decoration: it shows when the pointer is
   over the code, and stays put whenever a fold is actually closed. */
[data-code]:hover [${TOGGLE}], [data-column-number][${CLOSED}] [${TOGGLE}] {
  opacity: 0.7;
}
[${TOGGLE}]:hover { opacity: 1; }
`;

const indexOf = (element: Element): number | null => {
  const raw = element.getAttribute("data-line-index");
  if (raw === null) return null;
  // A diff row carries a pair; a plain file's rows carry one number.
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Put a chevron in a foldable line's gutter cell, or take one away. */
function toggleChevron(cell: Element, closed: boolean, foldable: boolean) {
  const existing = cell.querySelector(`[${TOGGLE}]`);
  if (!foldable) {
    existing?.remove();
    return;
  }
  const chevron = existing ?? cell.ownerDocument.createElement("button");
  if (existing === null) {
    chevron.setAttribute(TOGGLE, "");
    chevron.setAttribute("type", "button");
    chevron.setAttribute("tabindex", "-1");
    cell.append(chevron);
  }
  const label = closed ? "Unfold" : "Fold";
  if (chevron.getAttribute("aria-label") !== label) {
    chevron.setAttribute("aria-label", label);
    chevron.textContent = closed ? "▸" : "▾";
  }
}

export interface FoldPainting {
  /** Zero-based line indexes to hide. */
  readonly hidden: ReadonlySet<number>;
  /** Zero-based header lines of every region, foldable whether closed or not. */
  readonly foldable: ReadonlySet<number>;
  /** Zero-based header lines of the closed regions. */
  readonly closed: ReadonlySet<number>;
}

/** Remove every mark this module applied, leaving the rows as they were found. */
export function clearFolds(root: ParentNode): void {
  for (const element of root.querySelectorAll(MARKED)) {
    element.removeAttribute(HIDDEN);
    element.removeAttribute(FOLDABLE);
    element.removeAttribute(CLOSED);
  }
  for (const chevron of root.querySelectorAll(`[${TOGGLE}]`)) chevron.remove();
}

/**
 * Apply `painting` to the rows under `root`. Returns how many rows were hidden,
 * which the tests assert on and callers can ignore.
 */
export function paintFolds(root: ParentNode, painting: FoldPainting): number {
  let hiddenRows = 0;
  for (const element of root.querySelectorAll(INDEXED)) {
    const line = indexOf(element);
    if (line === null) continue;

    if (painting.hidden.has(line)) {
      element.setAttribute(HIDDEN, "");
      hiddenRows += 1;
    } else element.removeAttribute(HIDDEN);

    const foldable = painting.foldable.has(line);
    const closed = painting.closed.has(line);
    if (foldable) element.setAttribute(FOLDABLE, "");
    else element.removeAttribute(FOLDABLE);
    if (closed) element.setAttribute(CLOSED, "");
    else element.removeAttribute(CLOSED);

    if (element.hasAttribute("data-column-number")) {
      toggleChevron(element, closed, foldable);
    }
  }
  return hiddenRows;
}

/**
 * The line a click was meant for: the chevron in a gutter cell, or the `⋯`
 * badge on a closed line — which is the whole of a folded block's click target,
 * since its body is not on screen to be clicked.
 *
 * Takes the event rather than its target because the rows are in a shadow root:
 * by the time a listener on `window` sees the event, `target` has been
 * retargeted to the host element and the chevron is no longer in it. The
 * composed path still starts at what was actually pressed.
 */
export function foldTargetOf(event: Event): number | null {
  const target = event.composedPath()[0] ?? event.target;
  if (!(target instanceof Element)) return null;
  const row = target.closest(`[${FOLDABLE}]`);
  if (row === null) return null;
  // Only the chevron and a closed line answer to a click. A plain click on an
  // open line's gutter belongs to the editor, which selects lines with it.
  const onChevron = target.closest(`[${TOGGLE}]`) !== null;
  if (!onChevron && !row.hasAttribute(CLOSED)) return null;
  return indexOf(row);
}
