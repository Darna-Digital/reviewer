/**
 * The size of a drag-resizable panel, held in the DOM rather than in React.
 *
 * A resize handle reports a new size on every `pointermove` — around sixty
 * times a second for as long as the drag lasts. When the shell held those sizes
 * in `useState`, each of those reports re-rendered the whole shell: the tree,
 * the diff pane and every file section in it, the tab strip, the bottom dock
 * and its history list. None of that had changed. The panel got wider, and the
 * app re-rendered itself to say so, sixty times a second.
 *
 * So the size stops being React state. The panel reads its size from a CSS
 * custom property, the drag writes that property straight onto the document,
 * and React is told once — when the drag ends and the size is worth
 * remembering. The gesture costs a style recalculation per frame instead of a
 * full render pass, and the panel still lands wherever it was dropped.
 *
 * The style object is stable across renders too, so a panel that does re-render
 * for its own reasons is not handed a new `style` prop for a size that did not
 * change.
 *
 * Where the property is written matters as much as that it is one. A custom
 * property inherits, so changing it on the document element invalidates the
 * computed style of every element in the document, and the recalc it costs is
 * the size of the page rather than of the panel — several milliseconds a frame
 * on a window holding a diff, two trees and a dock, which is most of a frame
 * budget spent before the panel has laid out at all. So a panel nothing else
 * measures by keeps the property on its own element (`scope`), where the recalc
 * stops at its own subtree; only a size other elements are laid out by — the
 * sidebar, whose width places the header and the seam — is written on the
 * document, where they can all read it.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type RefObject,
} from "react";

/** Layout effects only exist in the browser; the prerender pass uses the other. */
const useApplyEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

export interface PanelSize {
  /**
   * The panel's own style — `{ width: "var(--panel-…)" }`, one object for the
   * lifetime of the component, so it never itself causes a re-render.
   */
  readonly style: CSSProperties;
  /** The size right now, in px. What a drag starts measuring from. */
  readonly current: () => number;
  /** Move the panel, without re-rendering anything. */
  readonly onResize: (next: number) => void;
}

/**
 * `name` must be unique across the app — these are custom properties on the
 * document element, so two panels sharing a name share a size. `stored` is the
 * remembered size: seeding from it before paint is what keeps a panel from
 * flashing at its default width on load, and re-applying when it changes is
 * what lets something other than the drag (a reset, another window) move the
 * panel.
 *
 * `scope` is the element to write the property on instead of the document —
 * the panel itself, or an ancestor of everything sized by it. It must be
 * mounted for as long as the panel is: the size is lost with the element.
 */
export function usePanelSize(
  name: string,
  stored: number,
  axis: "width" | "height",
  scope?: RefObject<HTMLElement | null>
): PanelSize {
  const property = `--panel-${name}`;
  const live = useRef(stored);

  const apply = useCallback(
    (next: number) => {
      if (typeof document === "undefined") return;
      const target = scope?.current ?? document.documentElement;
      target.style.setProperty(property, `${next}px`);
    },
    [property, scope]
  );

  // Before paint, so the panel's first frame is already the remembered size.
  useApplyEffect(() => {
    live.current = stored;
    apply(stored);
  }, [apply, stored]);

  const style = useMemo(
    (): CSSProperties => ({ [axis]: `var(${property})` }),
    [axis, property]
  );

  const onResize = useCallback(
    (next: number) => {
      live.current = next;
      apply(next);
    },
    [apply]
  );

  const current = useCallback(() => live.current, []);

  return { style, current, onResize };
}
