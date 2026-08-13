/**
 * The live view itself: the tab's own page, running in a preview window and
 * scaled into the box it is given.
 *
 * Booting one is not free — it is the whole app again — so a frame is started
 * late and kept for as long as it is worth keeping:
 *
 *  - nothing starts until the box has been shown for `bootDelayMs`, so opening
 *    the launchpad on a dozen tabs costs nothing until you stay in it;
 *  - a frame that has booted stays booted when the launchpad collapses — the
 *    panel around it is hidden, not unmounted — so opening it again is instant,
 *    until the frame falls out of the warm list and is dropped;
 *  - the page it points at is only re-pointed while it is on screen, so a tab
 *    following your navigation doesn't reload a frame nobody is looking at.
 *
 * The page fades in over the shimmer once it is up: a preview that pops into
 * existence reads as a glitch, and one that leaves a hole reads as broken.
 */
import { useEffect, useState } from "react";
import { previewUrl } from "@/lib/preview-window";
import { cn } from "@/lib/utils";
import { useWarmPreview, warmPreview } from "../adapters/preview-cache.store";
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
  bootDelayMs,
  cacheKey,
  active = true,
  className,
}: {
  readonly target: PreviewTarget;
  readonly zoom: PreviewZoom;
  /** How long the box must stay on screen before its frame is worth starting. */
  readonly bootDelayMs: number;
  /** What this box's frame is held under — one frame per box, not per tab. */
  readonly cacheKey: string;
  /** Whether the box is being shown; a hidden one neither boots nor re-points. */
  readonly active?: boolean;
  readonly className?: string;
}) {
  const warm = useWarmPreview(cacheKey);
  const [shown, setShown] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active || shown === target.href) return;
    const timer = window.setTimeout(() => {
      warmPreview(cacheKey);
      setShown(target.href);
    }, bootDelayMs);
    return () => window.clearTimeout(timer);
  }, [active, bootDelayMs, cacheKey, shown, target.href]);

  // Shown again after being dropped: the frame is gone, so it boots afresh.
  useEffect(() => {
    if (!warm && shown !== null) setShown(null);
  }, [warm, shown]);

  useEffect(() => setLoaded(false), [shown]);

  return (
    <div
      style={{ aspectRatio: PREVIEW_ASPECT }}
      className={cn(
        "relative isolate w-full overflow-hidden bg-background",
        className
      )}
    >
      {shown !== null && warm && (
        <iframe
          // The page is there to be looked at: the pointer belongs to the card
          // over it, and the tab order to the controls beside it.
          aria-hidden
          tabIndex={-1}
          title={`${target.title} preview`}
          src={previewUrl(shown)}
          style={previewFrameStyle(zoom)}
          onLoad={() => setLoaded(true)}
          className={cn(
            "pointer-events-none absolute top-0 left-0 border-0 transition-opacity duration-300 ease-out",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 animate-pulse bg-elevate transition-opacity duration-300",
          loaded && "opacity-0"
        )}
      />
    </div>
  );
}
