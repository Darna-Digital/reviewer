/**
 * A card's picture of a section: the page the mill last lifted out of the
 * preview window, hung back up beside the app.
 *
 * Nothing here runs and nothing here loads. The markup goes into a shadow root
 * — so a page's ids, its `body` rules and its stray global selectors stay
 * inside the card — and the rules go in as one stylesheet adopted by every card
 * at once. What that costs is a parse of markup the window already had and a
 * paint of it: no document, no navigation, no second copy of the app.
 *
 * A section that has not been photographed yet keeps its own name in the box
 * rather than a shimmer that never resolves: the mill works round one page at a
 * time, and a card can be waiting a moment for its turn.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  usePreviewStyles,
  useTabSnapshot,
} from "../adapters/tab-snapshots.store";
import {
  SCROLL_LEFT_ATTRIBUTE,
  SCROLL_TOP_ATTRIBUTE,
  SHEET_KEYS_ATTRIBUTE,
} from "../functions/preview-capture.functions";
import { previewDocument } from "../functions/preview-document.functions";
import { PREVIEW_ASPECT } from "../functions/tab-preview.functions";
import type { TabSnapshot } from "../functions/tab-snapshot.functions";
import type { PreviewTarget } from "../interfaces/tab-preview.interfaces";

/** Constructed once per stylesheet, however many cards go on to adopt it. */
const adopted = new Map<string, CSSStyleSheet>();

function sheetFor(cssText: string): CSSStyleSheet | null {
  const held = adopted.get(cssText);
  if (held !== undefined) return held;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    adopted.set(cssText, sheet);
    return sheet;
  } catch {
    return null;
  }
}

/** The component stylesheets the picture's own shadow trees were wearing. */
function hydrateShadowTrees(root: ShadowRoot | Element, snapshot: TabSnapshot) {
  for (const element of root.querySelectorAll("*")) {
    const shadow = element.shadowRoot;
    if (shadow === null) continue;
    shadow.adoptedStyleSheets = (
      element.getAttribute(SHEET_KEYS_ATTRIBUTE)?.split(" ") ?? []
    )
      .map((key) => snapshot.shadowSheets[key])
      .filter((cssText) => cssText !== undefined)
      .map(sheetFor)
      .filter((sheet) => sheet !== null);
    hydrateShadowTrees(shadow, snapshot);
  }
}

/** Scroll is a property rather than an attribute, so it is put back by hand. */
function restoreScroll(root: ShadowRoot | Element) {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    const top = element.getAttribute(SCROLL_TOP_ATTRIBUTE);
    const left = element.getAttribute(SCROLL_LEFT_ATTRIBUTE);
    if (top !== null) element.scrollTop = Number(top);
    if (left !== null) element.scrollLeft = Number(left);
    if (element.shadowRoot !== null) restoreScroll(element.shadowRoot);
  }
}

export function TabPreviewFrame({
  target,
  className,
}: {
  readonly target: PreviewTarget;
  readonly className?: string;
}) {
  const snapshot = useTabSnapshot(target.href);
  const styles = usePreviewStyles();
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  // A picture is a window's worth of page at the size it was laid out; the card
  // is however wide the grid made it, and the two are met with a scale. Measured
  // from the box rather than waited for: the launchpad is parked above the
  // window rather than emptied, so a card is its own size long before it is
  // slid into view — which is what keeps the pictures from arriving after it.
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host === null || snapshot === undefined) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const sheet = sheetFor(styles);
    shadow.adoptedStyleSheets = sheet === null ? [] : [sheet];
    // The shadow trees inside the picture arrive as declarative templates:
    // `innerHTML` would leave them inert, and a diff pane along with them.
    if (typeof shadow.setHTMLUnsafe !== "function") return;
    shadow.setHTMLUnsafe(previewDocument(snapshot));
    hydrateShadowTrees(shadow, snapshot);
    restoreScroll(shadow);
  }, [snapshot, styles]);

  const scale = snapshot === undefined ? 0 : width / snapshot.width;
  const drawn = snapshot !== undefined && scale > 0;

  return (
    <div
      ref={boxRef}
      style={{
        aspectRatio:
          snapshot === undefined
            ? PREVIEW_ASPECT
            : `${snapshot.width} / ${snapshot.height}`,
      }}
      className={cn(
        "relative isolate w-full overflow-hidden bg-background",
        className
      )}
    >
      {/* `inert` keeps the page out of the tab order and out of the pointer's
          way: it is there to be looked at, and the control that picks the
          section is laid over it. */}
      <div
        ref={hostRef}
        aria-hidden
        inert
        style={{
          width: snapshot?.width,
          height: snapshot?.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: drawn ? "visible" : "hidden",
          // A picture is a page's worth of nodes and the card is already the
          // size it will be: nothing in there can change anything out here, and
          // saying so keeps a grid of them out of the window's own layout.
          contain: "strict",
        }}
        className="pointer-events-none absolute top-0 left-0"
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground transition-opacity duration-300",
          drawn && "opacity-0"
        )}
      >
        {target.title}
      </div>
    </div>
  );
}
