/**
 * SidebarResizeHandle — the seam a sidebar is resized by, and the only way it
 * is put away: pinch it past the point the panel is still worth showing and
 * letting go hides the sidebar instead. The width it had is kept, so bringing
 * it back brings back the panel you left rather than the sliver you dragged it
 * down to.
 */
import { ResizeHandle } from "@/components/layout/resize-handle";
import { setUiPrefs } from "@/lib/ui-prefs";

/** Below this the drag reads as closing the sidebar rather than sizing it. */
const COLLAPSE_WIDTH = 140;

export function SidebarResizeHandle({
  width,
  stored,
  max,
  onResize,
  onResizeEnd,
  label = "Resize sidebar",
  className,
}: {
  /** The live width the drag measures from — see `ResizeHandle`'s `value`. */
  width: number | (() => number);
  /** The width the sidebar keeps when the drag closes it instead. */
  stored: number;
  max: () => number;
  onResize: (width: number) => void;
  onResizeEnd: (width: number) => void;
  label?: string;
  /**
   * `resize-handle-seam` where the sidebar is a sheet on the frame rather than
   * a column inside one, so the handle lies in the seam between the two instead
   * of straddling a border.
   */
  className?: string;
}) {
  return (
    <ResizeHandle
      orientation="col"
      label={label}
      className={className}
      value={width}
      min={COLLAPSE_WIDTH}
      max={max}
      onResize={onResize}
      onResizeEnd={(next) => {
        if (next > COLLAPSE_WIDTH) {
          onResizeEnd(next);
          return;
        }
        onResize(stored);
        setUiPrefs({ sidebarVisible: false });
      }}
    />
  );
}
