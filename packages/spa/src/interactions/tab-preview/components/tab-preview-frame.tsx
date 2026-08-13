/**
 * A card's picture of its tab: the markup the renderer last took, shown as
 * itself.
 *
 * Nothing here runs. The frame is a `srcdoc` document with no scripts allowed
 * into it, so what it costs is a parse and a paint of static HTML against the
 * app's own stylesheet — the same thing whether there is one card or twenty,
 * and the same again every time the launchpad is reopened.
 *
 * A tab that has not been photographed yet keeps its own name in the box rather
 * than a shimmer that never resolves: the renderer works round one page at a
 * time, and a card can be waiting a moment for its turn.
 */
import { cn } from "@/lib/utils";
import { useTabSnapshot } from "../adapters/tab-snapshots.store";
import {
  previewFrameStyle,
  PREVIEW_ASPECT,
} from "../functions/tab-preview.functions";
import type {
  PreviewTarget,
  PreviewZoom,
} from "../interfaces/tab-preview.interfaces";

export function TabPreviewFrame({
  target,
  zoom,
  className,
}: {
  readonly target: PreviewTarget;
  readonly zoom: PreviewZoom;
  readonly className?: string;
}) {
  const snapshot = useTabSnapshot(target.href);

  return (
    <div
      style={{ aspectRatio: PREVIEW_ASPECT }}
      className={cn(
        "relative isolate w-full overflow-hidden bg-background",
        className
      )}
    >
      {snapshot !== undefined && (
        <iframe
          // The page is there to be looked at: the pointer belongs to the card
          // over it, and the tab order to the controls beside it.
          aria-hidden
          tabIndex={-1}
          title={`${target.title} preview`}
          srcDoc={snapshot.html}
          // Same origin so the app's stylesheet still loads; no `allow-scripts`,
          // so nothing in the document can run.
          sandbox="allow-same-origin"
          style={previewFrameStyle(zoom)}
          className="pointer-events-none absolute top-0 left-0 border-0"
        />
      )}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground transition-opacity duration-300",
          snapshot !== undefined && "opacity-0"
        )}
      >
        {target.title}
      </div>
    </div>
  );
}
