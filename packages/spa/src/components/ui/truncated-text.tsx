"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Row tooltips sit flush against the row they explain, like a submenu opening
 * off it, but centred on it — the tooltip is taller than a row, so aligning
 * their top edges leaves it hanging visibly low.
 *
 * They stay on the right whatever the row's place on screen. Left to flip, a
 * list near the window's right edge would speak from its left and an identical
 * list in the middle from its right, so the same menu reads as two different
 * components depending on where it was opened. Shifting instead of flipping
 * keeps that one habit while still fitting: the tooltip's width is already
 * capped at `--available-width`, so it wraps into the space on its side rather
 * than needing to be pushed back over the row.
 */
export const ROW_TOOLTIP_PLACEMENT = {
  side: "right",
  sideOffset: 0,
  align: "center",
  alignOffset: 0,
  collisionAvoidance: {
    side: "shift",
    align: "shift",
    fallbackAxisSide: "none",
  },
} as const;

interface Props {
  text: string;
  className?: string;
}

export const truncatedTooltipClass =
  "max-w-[min(40rem,var(--available-width,40rem))] text-sm font-normal break-words whitespace-normal";

/** Sub-pixel rounding leaves a snugly-fitting element one pixel "over". */
const CLIP_SLACK = 1;

const isClipped = (node: HTMLElement) =>
  node.scrollWidth > node.clientWidth + CLIP_SLACK;

/**
 * Drives a tooltip that speaks only for text the layout has cut off: `read`
 * runs the moment the tooltip asks to open and answers with what to say, or
 * null to stay shut.
 *
 * Measuring any earlier — on hover, on mount — is what makes the tooltip miss.
 * A width read during the hover only reaches state on the next render, by which
 * point the pointer is already inside, and base-ui opens a tooltip on entering
 * its trigger and on nothing after that. A row therefore spends its one hover
 * measuring and stays silent; a menu row, remounted every time its menu opens,
 * never gets a second one.
 */
export function useClipGate<T extends HTMLElement>(
  read: (node: T) => string | null
) {
  const ref = useRef<T>(null);
  const [full, setFull] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const gate = (wanted: boolean) => {
    const node = ref.current;
    const text = wanted && node !== null ? read(node) : null;
    setFull(text);
    setOpen(text !== null);
  };

  const close = useCallback(() => {
    setFull(null);
    setOpen(false);
  }, []);

  return { ref, full, open, gate, close };
}

/** The full text of whichever descendant is ellipsized, if any. */
export function clippedText(row: HTMLElement): string | null {
  const node = isClipped(row)
    ? row
    : Array.from(row.querySelectorAll<HTMLElement>("*")).find(isClipped);
  const text = node?.textContent?.trim();
  return text !== undefined && text.length > 0 ? text : null;
}

/**
 * Set by a row that owns a popup — a submenu trigger — for as long as it is up.
 * `data-popup-open` can't be used here: the tooltip stamps that on its own
 * trigger, so a row would read its own tooltip as the popup to yield to.
 */
const EXPANDED = "aria-expanded";

const ownsOpenPopup = (row: Element | null) =>
  row?.getAttribute(EXPANDED) === "true";

/**
 * Wraps a row in a tooltip that appears only once something inside it is
 * ellipsized, reading the label back off the DOM so rows assembled from
 * arbitrary children — menu items, options, list rows — need not name upfront
 * which of their parts might overflow. The whole row is the trigger, so a
 * clipped label can be read without aiming at the text itself.
 *
 * A row that opens a popup of its own never tooltips over it: the tooltip is
 * refused while the popup is up, and steps aside if the popup opens under it.
 */
export function TruncatedRow({
  render,
  children,
  delay,
}: {
  render: React.ReactElement;
  children?: React.ReactNode;
  delay?: number;
}) {
  // `TooltipTrigger` types its ref as a button even when `render` swaps the tag.
  const { ref, full, open, gate, close } = useClipGate<HTMLButtonElement>(
    // A row with nothing clipped has nothing to say, and refusing to open is
    // what keeps it quiet: a live-but-empty tooltip is not inert, it is still a
    // dismissable layer, so it answers the first Escape and the menu around it
    // stays open. Every menu in the app needed two presses to close once the
    // arrow keys had focused a row.
    (row) => (ownsOpenPopup(row) ? null : clippedText(row))
  );

  useEffect(() => {
    const row = ref.current;
    if (!open || row === null) return;
    const yieldToPopup = () => {
      if (ownsOpenPopup(row)) close();
    };
    const observer = new MutationObserver(yieldToPopup);
    observer.observe(row, { attributeFilter: [EXPANDED] });
    return () => observer.disconnect();
  }, [open, close, ref]);

  return (
    <Tooltip open={open} onOpenChange={gate}>
      <TooltipTrigger ref={ref} render={render} delay={delay}>
        {children}
      </TooltipTrigger>
      {full !== null && (
        <TooltipContent
          {...ROW_TOOLTIP_PLACEMENT}
          className={truncatedTooltipClass}
        >
          {full}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function TruncatedText({ text, className }: Props) {
  const { ref, full, open, gate } = useClipGate<HTMLSpanElement>(clippedText);

  return (
    <Tooltip open={open} onOpenChange={gate}>
      <TooltipTrigger
        render={
          <span ref={ref} className={cn("block min-w-0 truncate", className)} />
        }
      >
        {text}
      </TooltipTrigger>
      {full !== null && (
        <TooltipContent
          {...ROW_TOOLTIP_PLACEMENT}
          className={truncatedTooltipClass}
        >
          {full}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
