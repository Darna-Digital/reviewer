"use client"

import { useEffect, useRef, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Side = "top" | "right" | "bottom" | "left"

interface Props {
  text: string
  className?: string
  side?: Side
  sideOffset?: number
}

export const truncatedTooltipClass =
  "max-w-[min(40rem,var(--available-width,40rem))] text-sm font-normal break-words whitespace-normal"

/** Sub-pixel rounding leaves a snugly-fitting element one pixel "over". */
const CLIP_SLACK = 1

const isClipped = (node: HTMLElement) =>
  node.scrollWidth > node.clientWidth + CLIP_SLACK

/**
 * Tracks whether `text` overflows the element the returned ref is on, so a
 * caller can trigger the tooltip from a wider region than the text itself.
 */
export function useClippedText<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null)
  const [clipped, setClipped] = useState(false)

  const measure = () => {
    const node = ref.current
    if (node) setClipped(isClipped(node))
  }

  useEffect(measure, [text])

  return { ref, clipped, measure }
}

/** The full text of whichever descendant is ellipsized, if any. */
export function clippedText(row: HTMLElement): string | null {
  const node = isClipped(row)
    ? row
    : Array.from(row.querySelectorAll<HTMLElement>("*")).find(isClipped)
  const text = node?.textContent?.trim()
  return text !== undefined && text.length > 0 ? text : null
}

/**
 * Wraps a row in a tooltip that appears only once something inside it is
 * ellipsized, reading the label back off the DOM so rows assembled from
 * arbitrary children — menu items, options, list rows — need not name upfront
 * which of their parts might overflow. The whole row is the trigger, so a
 * clipped label can be read without aiming at the text itself.
 */
export function TruncatedRow({
  render,
  children,
  side = "right",
  sideOffset = 8,
}: {
  render: React.ReactElement
  children?: React.ReactNode
  side?: Side
  sideOffset?: number
}) {
  // `TooltipTrigger` types its ref as a button even when `render` swaps the tag.
  const ref = useRef<HTMLButtonElement>(null)
  const [full, setFull] = useState<string | null>(null)
  const measure = () => {
    if (ref.current !== null) setFull(clippedText(ref.current))
  }

  return (
    <Tooltip>
      <TooltipTrigger
        ref={ref}
        render={render}
        onMouseEnter={measure}
        onFocus={measure}
      >
        {children}
      </TooltipTrigger>
      {full !== null && (
        <TooltipContent
          side={side}
          sideOffset={sideOffset}
          className={truncatedTooltipClass}
        >
          {full}
        </TooltipContent>
      )}
    </Tooltip>
  )
}

export function TruncatedText({
  text,
  className,
  side = "right",
  sideOffset = 8,
}: Props) {
  const { ref, clipped, measure } = useClippedText<HTMLSpanElement>(text)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            onMouseEnter={measure}
            className={cn("min-w-0 truncate", className)}
          />
        }
      >
        {text}
      </TooltipTrigger>
      {clipped && (
        <TooltipContent
          side={side}
          sideOffset={sideOffset}
          className={truncatedTooltipClass}
        >
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
