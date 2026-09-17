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

[data-column-number][${FOLDABLE}] { position: relative; }

/* The same square as the gutter's add-a-comment \`+\`: pierre gives that button
   a box of 1lh around a 16px icon, so the chevron takes both. There is exactly
   1ch of gutter padding and 1ch of the code's own on either side of the number
   column's edge, so a 1lh box pulled out by half its width centres on that
   channel and the icon fills it — clear of the last digit on one side and the
   first character on the other. The z-index is the button's, so the two halves
   of the row's chrome float over the code the same way. */
[${TOGGLE}] {
  position: absolute;
  inset-block: 0;
  inset-inline-end: -0.5lh;
  width: 1lh;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
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

/**
 * The arrow itself, drawn rather than typed: the triangles `▾`/`▸` render at
 * whatever size and weight the fallback font happens to give them, which is
 * nowhere near the 16px icon in the `+` beside it. A path of the same size is
 * the only way the two read as one control in two states.
 */
const chevronSVG = (closed: boolean): string =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${
    closed ? "M6 3l5 5-5 5" : "M3 6l5 5 5-5"
  }"/></svg>`;

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
    chevron.innerHTML = chevronSVG(closed);
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
 * The line a click was meant for: the chevron in a gutter cell, and only that.
 *
 * A folded line's own text is not a fold control. It is still code — clicking
 * `/**` to put the caret in it should do that, not expand eighteen lines
 * underneath — so the gutter keeps the gesture, where the chevron already turns
 * round to say which way it goes.
 *
 * Takes the event rather than its target because the rows are in a shadow root:
 * by the time a listener on `window` sees the event, `target` has been
 * retargeted to the host element and the chevron is no longer in it. The
 * composed path still starts at what was actually pressed.
 */
export function foldTargetOf(event: Event): number | null {
  const target = event.composedPath()[0] ?? event.target;
  if (!(target instanceof Element)) return null;
  if (target.closest(`[${TOGGLE}]`) === null) return null;
  const row = target.closest(`[${FOLDABLE}]`);
  return row === null ? null : indexOf(row);
}
