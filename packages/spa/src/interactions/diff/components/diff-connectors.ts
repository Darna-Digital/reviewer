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
 */
type RibbonKind = "add" | "del" | "mod";

interface Ribbon {
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

const rowRects = (
  column: Element,
  selector: string,
  originTop: number
): Array<Band> =>
  Array.from(column.querySelectorAll(selector)).map((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top - originTop, bottom: rect.bottom - originTop };
  });

const toBands = (rows: ReadonlyArray<Band>): Array<Band> => {
  const sorted = [...rows].sort((a, b) => a.top - b.top);
  const bands: Array<Band> = [];
  for (const row of sorted) {
    const last = bands[bands.length - 1];
    if (last !== undefined && row.top <= last.bottom + 1) {
      last.bottom = Math.max(last.bottom, row.bottom);
    } else {
      bands.push({ top: row.top, bottom: row.bottom });
    }
  }
  return bands;
};

const spanWithin = (rows: ReadonlyArray<Band>, band: Band): Band | null => {
  const inside = rows.filter(
    (row) => row.bottom > band.top && row.top < band.bottom
  );
  if (inside.length === 0) return null;
  return {
    top: Math.min(...inside.map((row) => row.top)),
    bottom: Math.max(...inside.map((row) => row.bottom)),
  };
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

  const delChanges = rowRects(
    deletions,
    '[data-line-type="change-deletion"]',
    base.top
  );
  const addChanges = rowRects(
    additions,
    '[data-line-type="change-addition"]',
    base.top
  );
  const buffers = [
    ...rowRects(deletions, "[data-gutter-buffer]", base.top),
    ...rowRects(additions, "[data-gutter-buffer]", base.top),
  ];

  const ribbons: Array<Ribbon> = [];
  for (const band of toBands([...delChanges, ...addChanges, ...buffers])) {
    const left = spanWithin(delChanges, band);
    const right = spanWithin(addChanges, band);
    if (left == null && right == null) continue;
    const mid = (band.top + band.bottom) / 2;
    const kind: RibbonKind =
      left == null ? "add" : right == null ? "del" : "mod";
    ribbons.push({
      kind,
      leftTop: left?.top ?? mid,
      leftBottom: left?.bottom ?? mid,
      rightTop: right?.top ?? mid,
      rightBottom: right?.bottom ?? mid,
    });
  }

  return {
    width: base.width,
    height: base.height,
    stripLeft,
    stripRight,
    ribbons,
  };
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
 * How many frames a host is re-measured for after a render before its ribbons
 * are taken as settled: the code lays out progressively (highlighting lands,
 * annotations mount), and the signature going still twice in a row is the
 * sign it is done.
 */
const SETTLE_FRAMES = 12;

const signatureOf = (geometry: Geometry | null): string =>
  geometry === null
    ? "∅"
    : `${geometry.width}|${geometry.stripLeft}|${geometry.stripRight}|${geometry.ribbons
        .map((r) => `${r.kind}${r.leftTop | 0},${r.rightTop | 0}`)
        .join(";")}`;

interface Painting {
  frame: number;
  signature: string;
}

/**
 * Keeps one ribbon overlay per rendered host, re-measuring a host for a few
 * frames after each render until its geometry stops moving.
 */
export class ConnectorPainter {
  private readonly paintings = new Map<HTMLElement, Painting>();

  schedule(host: HTMLElement): void {
    const current = this.paintings.get(host);
    if (current !== undefined) cancelAnimationFrame(current.frame);
    const painting: Painting = {
      frame: 0,
      signature: current?.signature ?? "",
    };
    this.paintings.set(host, painting);
    let stable = 0;
    let frames = 0;
    const tick = () => {
      if (this.paintings.get(host) !== painting) return;
      const geometry = host.isConnected ? measure(host) : null;
      const signature = signatureOf(geometry);
      if (signature !== painting.signature) {
        painting.signature = signature;
        this.draw(host, geometry);
        stable = 0;
      } else {
        stable += 1;
      }
      if (stable < 2 && frames++ < SETTLE_FRAMES) {
        painting.frame = requestAnimationFrame(tick);
      }
    };
    painting.frame = requestAnimationFrame(tick);
  }

  clear(host: HTMLElement): void {
    const painting = this.paintings.get(host);
    if (painting !== undefined) cancelAnimationFrame(painting.frame);
    this.paintings.delete(host);
    host.shadowRoot?.querySelector(".diff-connectors")?.remove();
  }

  clearAll(): void {
    for (const host of [...this.paintings.keys()]) this.clear(host);
  }

  private draw(host: HTMLElement, geometry: Geometry | null): void {
    const root = host.shadowRoot;
    if (root === null) return;
    const existing = root.querySelector(".diff-connectors");
    if (geometry === null || geometry.ribbons.length === 0) {
      existing?.remove();
      return;
    }
    const svg = existing ?? document.createElementNS(SVG_NS, "svg");
    if (existing === null) {
      svg.setAttribute("class", "diff-connectors");
      svg.setAttribute("aria-hidden", "true");
      root.appendChild(svg);
    }
    svg.setAttribute("width", String(geometry.width));
    svg.setAttribute("height", String(geometry.height));
    svg.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
    svg.replaceChildren(
      ...geometry.ribbons.map((ribbon) => {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `cx-${ribbon.kind}`);
        path.setAttribute(
          "d",
          ribbonPath(ribbon, geometry.stripLeft, geometry.stripRight)
        );
        return path;
      })
    );
  }
}
