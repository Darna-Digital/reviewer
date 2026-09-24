/**
 * JetBrains-style connector ribbons for Pierre split diffs. Pierre renders the
 * split view as a two-column grid inside a `<diffs-container>` shadow root; we
 * widen the seam (via the CodeView `unsafeCSS` option) and paint filled bézier
 * ribbons into it, linking each change band's deletions (left) to additions
 * (right). Ported from the original client.
 *
 * The ribbons are drawn straight into the item's shadow root rather than by a
 * React overlay: under `CodeView` a file has no React section of its own — the
 * viewer owns each item's element and recycles it for another file once it
 * scrolls out of the rendered window — so the painter is told when an item
 * rendered (`onPostRender`) and keeps an `<svg>` per host, removed when the
 * host is let go.
 *
 * Measuring is the expensive half, and a scrolled file is re-rendered
 * constantly: a long file is virtualized inside its own item, so the rows in
 * the DOM are replaced as the viewport travels down it, and each of those
 * renders asks for the ribbons again. So the painter is built around spending
 * as little as possible per render:
 *
 *  - one rAF for the whole pane rather than one per file, with every file
 *    measured before any file is drawn. Measuring reads layout and drawing
 *    dirties it, so interleaving them across the four or five files on screen
 *    made each one force the layout the last had just invalidated;
 *  - the rows are read in one pass per column, banded in a single walk, and
 *    the drawn paths are kept and re-pointed rather than rebuilt.
 *
 * What is not traded away is settling. A file keeps being measured until its
 * geometry reads the same twice running, because a render is not the end of
 * the file moving: the virtualizer corrects its own buffers, annotations
 * mount a frame behind, highlighting lands. Stopping at a fixed count instead
 * let a file latch whatever it happened to measure mid-settle, and a ribbon
 * drawn from that never came back to be right — bands from the old layout
 * lying across the new one. Cheap and batched, then, rather than fewer looks.
 */
type RibbonKind = "add" | "del" | "mod";

export interface Ribbon {
  kind: RibbonKind;
  leftTop: number;
  leftBottom: number;
  rightTop: number;
  rightBottom: number;
}

interface Geometry {
  width: number;
  height: number;
  stripLeft: number;
  stripRight: number;
  ribbons: ReadonlyArray<Ribbon>;
}

interface Band {
  top: number;
  bottom: number;
}

export interface Row extends Band {
  /** A changed line, rather than the buffer padding a column's short side. */
  change: boolean;
}

/**
 * One column's rows — both the changed lines and the buffers that pad the
 * column, in a single query and a single pass, since walking a file's shadow
 * tree is most of what measuring costs.
 *
 * They come back in document order, which is not order down the page: a
 * column holds its gutter and its code as two runs, each ordered in itself,
 * and `querySelectorAll` hands them over one after the other. Putting them in
 * order is `ribbonsFrom`'s first act.
 */
const rowsOf = (
  column: Element,
  changeType: string,
  originTop: number
): Array<Row> => {
  const rows: Array<Row> = [];
  for (const element of column.querySelectorAll(
    `[data-line-type="${changeType}"],[data-gutter-buffer]`
  )) {
    const rect = element.getBoundingClientRect();
    rows.push({
      top: rect.top - originTop,
      bottom: rect.bottom - originTop,
      change: element.getAttribute("data-line-type") === changeType,
    });
  }
  return rows;
};

/** The two columns' rows as one run down the file. Each arrives sorted. */
const mergeRows = (
  left: ReadonlyArray<Row>,
  right: ReadonlyArray<Row>
): Array<Row> => {
  const merged: Array<Row> = [];
  let l = 0;
  let r = 0;
  while (l < left.length && r < right.length) {
    if (left[l].top <= right[r].top) merged.push(left[l++]);
    else merged.push(right[r++]);
  }
  for (; l < left.length; l += 1) merged.push(left[l]);
  for (; r < right.length; r += 1) merged.push(right[r]);
  return merged;
};

/** Rows that touch, or all but touch, are one change to draw a ribbon for. */
const toBands = (rows: ReadonlyArray<Row>): Array<Band> => {
  const bands: Array<Band> = [];
  for (const row of rows) {
    const last = bands[bands.length - 1];
    if (last !== undefined && row.top <= last.bottom + 1)
      last.bottom = Math.max(last.bottom, row.bottom);
    else bands.push({ top: row.top, bottom: row.bottom });
  }
  return bands;
};

/**
 * Reads the extent of one column's changed rows inside each band in turn.
 *
 * Bands and rows both run down the file in order and a row belongs to exactly
 * one band, so the reader carries on from where the last band left off. Asking
 * each band to search the whole column — which is what this did — is the
 * difference between a walk and a walk per band.
 */
const bandReader = (rows: ReadonlyArray<Row>) => {
  let start = 0;
  return (band: Band): Band | null => {
    while (start < rows.length && rows[start].bottom <= band.top) start += 1;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (let index = start; index < rows.length; index += 1) {
      const row = rows[index];
      if (row.top >= band.bottom) break;
      top = Math.min(top, row.top);
      bottom = Math.max(bottom, row.bottom);
    }
    return bottom === Number.NEGATIVE_INFINITY ? null : { top, bottom };
  };
};

/**
 * The ribbons for one file, from the rows of its two columns.
 *
 * Both lists are put in order down the page before anything reads them.
 * Everything below — the banding, and the reader that walks the bands and the
 * rows together — takes one run down the file, and given two runs spliced
 * together it does not merely lose a ribbon: a band swallows the file and its
 * ribbon is drawn across every other one. The rows a column answers with are
 * spliced in exactly that way, so the order is made here rather than assumed.
 */
export const ribbonsFrom = (
  left: ReadonlyArray<Row>,
  right: ReadonlyArray<Row>
): Array<Ribbon> => {
  const downThePage = (a: Row, b: Row): number => a.top - b.top;
  const leftRows = [...left].sort(downThePage);
  const rightRows = [...right].sort(downThePage);
  const readLeft = bandReader(leftRows.filter((row) => row.change));
  const readRight = bandReader(rightRows.filter((row) => row.change));

  const ribbons: Array<Ribbon> = [];
  for (const band of toBands(mergeRows(leftRows, rightRows))) {
    const leftSpan = readLeft(band);
    const rightSpan = readRight(band);
    if (leftSpan === null && rightSpan === null) continue;
    const mid = (band.top + band.bottom) / 2;
    const kind: RibbonKind =
      leftSpan === null ? "add" : rightSpan === null ? "del" : "mod";
    ribbons.push({
      kind,
      leftTop: leftSpan?.top ?? mid,
      leftBottom: leftSpan?.bottom ?? mid,
      rightTop: rightSpan?.top ?? mid,
      rightBottom: rightSpan?.bottom ?? mid,
    });
  }
  return ribbons;
};

const measure = (host: HTMLElement): Geometry | null => {
  const root = host.shadowRoot;
  if (root === null) return null;
  const deletions = root.querySelector("[data-deletions]");
  const additions = root.querySelector("[data-additions]");
  if (deletions === null || additions === null) return null;

  const base = host.getBoundingClientRect();
  const delRect = deletions.getBoundingClientRect();
  const addRect = additions.getBoundingClientRect();
  const stripLeft = delRect.right - base.left;
  const stripRight = addRect.left - base.left;
  if (stripRight - stripLeft < 2) return null;

  return {
    width: base.width,
    height: base.height,
    stripLeft,
    stripRight,
    ribbons: ribbonsFrom(
      rowsOf(deletions, "change-deletion", base.top),
      rowsOf(additions, "change-addition", base.top)
    ),
  };
};

/**
 * Whether a fresh measurement has anything new to draw. Compared field by
 * field rather than through a string built per file per frame, and to the
 * pixel, since a ribbon's edge lands on one.
 */
const sameGeometry = (a: Geometry | null, b: Geometry | null): boolean => {
  if (a === null || b === null) return a === b;
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.stripLeft !== b.stripLeft ||
    a.stripRight !== b.stripRight ||
    a.ribbons.length !== b.ribbons.length
  )
    return false;
  for (let index = 0; index < a.ribbons.length; index += 1) {
    const one = a.ribbons[index];
    const other = b.ribbons[index];
    if (
      one.kind !== other.kind ||
      (one.leftTop | 0) !== (other.leftTop | 0) ||
      (one.rightTop | 0) !== (other.rightTop | 0) ||
      (one.leftBottom | 0) !== (other.leftBottom | 0) ||
      (one.rightBottom | 0) !== (other.rightBottom | 0)
    )
      return false;
  }
  return true;
};

const ribbonPath = (
  ribbon: Ribbon,
  stripLeft: number,
  stripRight: number
): string => {
  const mid = (stripLeft + stripRight) / 2;
  const { leftTop, leftBottom, rightTop, rightBottom } = ribbon;
  return (
    `M ${stripLeft} ${leftTop} ` +
    `C ${mid} ${leftTop}, ${mid} ${rightTop}, ${stripRight} ${rightTop} ` +
    `L ${stripRight} ${rightBottom} ` +
    `C ${mid} ${rightBottom}, ${mid} ${leftBottom}, ${stripLeft} ${leftBottom} Z`
  );
};

/** Width of the seam opened between the two columns (also injected via unsafeCSS). */
export const CONNECTOR_GUTTER = 30;

/**
 * Styles for the seam and the ribbons, landed in the shadow root through
 * `unsafeCSS`: the document's own stylesheet cannot reach an `<svg>` inside
 * the host, though the `--cx-*` colours it declares inherit through.
 */
export const connectorsCSS = `
pre { column-gap: ${CONNECTOR_GUTTER}px; }
.diff-connectors {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}
.diff-connectors path { stroke-width: 1; }
.diff-connectors .cx-add { fill: var(--cx-add); fill-opacity: 0.22; stroke: var(--cx-add); stroke-opacity: 0.7; }
.diff-connectors .cx-del { fill: var(--cx-del); fill-opacity: 0.22; stroke: var(--cx-del); stroke-opacity: 0.7; }
.diff-connectors .cx-mod { fill: var(--cx-mod); fill-opacity: 0.2; stroke: var(--cx-mod); stroke-opacity: 0.65; }
`;

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The most frames a host is re-measured for after a render. What normally
 * ends the measuring is the geometry going still twice in a row; this is only
 * the stop for a file that never goes still, so one cannot hold the pane.
 */
const SETTLE_FRAMES = 12;

/**
 * Why a host is being measured. A file the viewer has just put on screen is
 * a file the host may have been holding another file a moment ago — the
 * viewer recycles its elements — so what was measured of it last is no longer
 * about the same code and is forgotten.
 */
export type ConnectorReason = "mounted" | "redrawn";

interface Job {
  framesLeft: number;
  stable: number;
}

const setAttributeIfChanged = (
  element: Element,
  name: string,
  value: string
): void => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

/**
 * Keeps one ribbon overlay per rendered host, re-measuring a host after each
 * render until its geometry stops moving.
 */
export class ConnectorPainter {
  private readonly jobs = new Map<HTMLElement, Job>();
  private readonly drawn = new Map<HTMLElement, Geometry | null>();
  private readonly overlays = new Map<HTMLElement, SVGSVGElement>();
  private frame: number | null = null;

  schedule(host: HTMLElement, reason: ConnectorReason = "mounted"): void {
    if (reason === "mounted") this.drawn.delete(host);
    const job = this.jobs.get(host);
    if (job === undefined)
      this.jobs.set(host, { framesLeft: SETTLE_FRAMES, stable: 0 });
    else {
      job.framesLeft = SETTLE_FRAMES;
      job.stable = 0;
    }
    if (this.frame === null) this.frame = requestAnimationFrame(this.run);
  }

  clear(host: HTMLElement): void {
    this.jobs.delete(host);
    this.drawn.delete(host);
    this.overlays.delete(host);
    host.shadowRoot?.querySelector(".diff-connectors")?.remove();
    if (this.jobs.size === 0) this.stop();
  }

  clearAll(): void {
    // Every host the painter has touched, not only the ones still being
    // measured: a file whose ribbons have settled is off the job list and
    // still carries an overlay.
    const touched = new Set([
      ...this.jobs.keys(),
      ...this.drawn.keys(),
      ...this.overlays.keys(),
    ]);
    for (const host of touched) this.clear(host);
    this.stop();
  }

  private stop(): void {
    if (this.frame === null) return;
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /**
   * One pass over every host waiting to be measured: all the reading first,
   * then all the drawing. Splitting them is the point — a draw dirties the
   * document's layout, so a read that follows one pays to have it computed
   * again, and with several files on screen that is a forced layout per file
   * per frame.
   */
  private readonly run = (): void => {
    this.frame = null;
    const changed: Array<[HTMLElement, Geometry | null]> = [];
    for (const [host, job] of this.jobs) {
      const geometry = host.isConnected ? measure(host) : null;
      if (sameGeometry(geometry, this.drawn.get(host) ?? null)) {
        job.stable += 1;
      } else {
        this.drawn.set(host, geometry);
        job.stable = 0;
        changed.push([host, geometry]);
      }
      job.framesLeft -= 1;
    }
    for (const [host, geometry] of changed) this.draw(host, geometry);
    for (const [host, job] of [...this.jobs])
      if (job.stable >= 2 || job.framesLeft <= 0) this.jobs.delete(host);
    if (this.jobs.size > 0 && this.frame === null)
      this.frame = requestAnimationFrame(this.run);
  };

  private draw(host: HTMLElement, geometry: Geometry | null): void {
    const root = host.shadowRoot;
    if (root === null) return;
    const held = this.overlays.get(host);
    const existing =
      held !== undefined && held.parentNode === root
        ? held
        : root.querySelector<SVGSVGElement>("svg.diff-connectors");
    if (geometry === null || geometry.ribbons.length === 0) {
      existing?.remove();
      this.overlays.delete(host);
      return;
    }
    let svg = existing;
    if (svg === null) {
      svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "diff-connectors");
      svg.setAttribute("aria-hidden", "true");
      root.appendChild(svg);
    }
    this.overlays.set(host, svg);
    setAttributeIfChanged(svg, "width", String(geometry.width));
    setAttributeIfChanged(svg, "height", String(geometry.height));
    setAttributeIfChanged(
      svg,
      "viewBox",
      `0 0 ${geometry.width} ${geometry.height}`
    );
    // The paths are kept and re-pointed: a band that has not moved costs
    // nothing, and a file scrolled through keeps the same handful of ribbons
    // while the numbers under them change.
    for (let index = 0; index < geometry.ribbons.length; index += 1) {
      const ribbon = geometry.ribbons[index];
      let path = svg.children.item(index);
      if (path === null) {
        path = document.createElementNS(SVG_NS, "path");
        svg.appendChild(path);
      }
      setAttributeIfChanged(path, "class", `cx-${ribbon.kind}`);
      setAttributeIfChanged(
        path,
        "d",
        ribbonPath(ribbon, geometry.stripLeft, geometry.stripRight)
      );
    }
    while (svg.children.length > geometry.ribbons.length)
      svg.lastElementChild?.remove();
  }
}
