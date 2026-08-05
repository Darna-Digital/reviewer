"use client";

import { useEffect, useRef, useState } from "react";
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
 */
export const ROW_TOOLTIP_PLACEMENT = {
  side: "right",
  sideOffset: 0,
  align: "center",
  alignOffset: 0,
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
 * Tracks whether `text` overflows the element the returned ref is on, so a
 * caller can trigger the tooltip from a wider region than the text itself.
 */
export function useClippedText<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [clipped, setClipped] = useState(false);

  const measure = () => {
    const node = ref.current;
    if (node) setClipped(isClipped(node));
  };

  useEffect(measure, [text]);

  return { ref, clipped, measure };
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
  const ref = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const measure = () => {
    if (ref.current !== null) setFull(clippedText(ref.current));
  };

  useEffect(() => {
    const row = ref.current;
    if (!open || row === null) return;
    const yieldToPopup = () => {
      if (ownsOpenPopup(row)) setOpen(false);
    };
    const observer = new MutationObserver(yieldToPopup);
    observer.observe(row, { attributeFilter: [EXPANDED] });
    return () => observer.disconnect();
  }, [open]);

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => setOpen(next && !ownsOpenPopup(ref.current))}
      // A row with nothing clipped has no tooltip to show, and a live-but-empty
      // tooltip is not inert: it is still a dismissable layer, so it answers the
      // first Escape and the menu around it stays open. Every menu in the app
      // needed two presses to close once the arrow keys had focused a row.
      disabled={full === null}
    >
      <TooltipTrigger
        ref={ref}
        render={render}
        delay={delay}
        onMouseEnter={measure}
        onFocus={measure}
      >
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
  const { ref, clipped, measure } = useClippedText<HTMLSpanElement>(text);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            onMouseEnter={measure}
            className={cn("block min-w-0 truncate", className)}
          />
        }
      >
        {text}
      </TooltipTrigger>
      {clipped && (
        <TooltipContent
          {...ROW_TOOLTIP_PLACEMENT}
          className={truncatedTooltipClass}
        >
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
