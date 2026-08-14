/**
 * ResizeHandle — a custom, dependency-free drag handle for resizing a panel.
 *
 * shadcn's resizable (react-resizable-panels) fights our flex/route-driven
 * layout, so — like the old client package — we roll our own: a thin divider
 * that owns the pointer-drag math and reports the new panel size back to the
 * parent, which keeps the size in state. The parent stays the source of truth;
 * the handle is purely the gesture.
 */
import {
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  /**
   * "col" → a vertical divider dragged horizontally (col-resize).
   * "row" → a horizontal divider dragged vertically (row-resize).
   */
  orientation: "col" | "row";
  /**
   * Current panel size in px. Captured fresh at the start of each drag.
   *
   * A function when the panel's size does not live in React state — see
   * `usePanelSize`, where the drag writes straight to the DOM and there is no
   * re-render to carry a new number down here.
   */
  value: number | (() => number);
  /** Lower bound, in px. */
  min: number;
  /** Upper bound, in px — a function so it can track the live viewport. */
  max: () => number;
  /**
   * How a positive pointer delta (moving right / down) changes the size:
   * +1 when the handle sits on the panel's trailing edge (e.g. a left
   * sidebar's right edge), -1 when on its leading edge (e.g. a bottom
   * panel's top edge). Defaults to +1.
   */
  direction?: 1 | -1;
  /** Called continuously during the drag with the clamped size. */
  onResize: (next: number) => void;
  /** Called once when the drag ends with the final clamped size. */
  onResizeEnd?: (next: number) => void;
  className?: string;
  label?: string;
}

export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  direction = 1,
  onResize,
  onResizeEnd,
  className,
  label = "Resize panel",
}: ResizeHandleProps) {
  // Only the handle actually being dragged should light up. The body cursor
  // class is global (so the resize cursor shows everywhere mid-drag), but the
  // highlight keys off this per-handle flag — otherwise every sibling row/col
  // handle would glow at once.
  const [dragging, setDragging] = useState(false);
  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      const axis = orientation === "col" ? "clientX" : "clientY";
      const start = event[axis];
      const startSize = typeof value === "function" ? value() : value;
      const cursorClass =
        orientation === "col" ? "is-resizing-col" : "is-resizing-row";
      document.body.classList.add(cursorClass);
      setDragging(true);

      // A shield over the whole window for the length of the drag. Without it a
      // pointer crossing anything that swallows input — the browser pane's
      // <webview>, which is a separate process, or an embedded terminal — takes
      // the rest of the gesture with it: no more `pointermove`, and crucially no
      // `pointerup`, so the drag never ends and the cursor stays stuck. The
      // shield keeps every event in this document, where the listeners below
      // still see it bubble to `window`.
      const shield = document.createElement("div");
      shield.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:transparent";
      shield.style.cursor = orientation === "col" ? "col-resize" : "row-resize";
      document.body.appendChild(shield);

      let latest = startSize;
      const onMove = (move: PointerEvent) => {
        const delta = (move[axis] - start) * direction;
        latest = Math.min(Math.max(startSize + delta, min), max());
        onResize(latest);
      };
      const onUp = () => {
        document.body.classList.remove(cursorClass);
        shield.remove();
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onUp);
        onResizeEnd?.(latest);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      // A drag interrupted rather than finished — the OS taking the pointer, or
      // the window losing focus — has to release the shield too, or it would
      // outlive the gesture and swallow every click after it.
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("blur", onUp);
    },
    [orientation, value, min, max, direction, onResize, onResizeEnd]
  );

  return (
    <div
      role="separator"
      aria-orientation={orientation === "col" ? "vertical" : "horizontal"}
      aria-label={label}
      title="Drag to resize"
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      className={cn(
        orientation === "col" ? "resize-handle-col" : "resize-handle-row",
        className
      )}
    />
  );
}
