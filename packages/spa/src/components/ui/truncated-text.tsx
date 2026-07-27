"use client"

import { useEffect, useRef, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Props {
  text: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
}

export function TruncatedText({
  text,
  className,
  side = "right",
  sideOffset = 8,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [clipped, setClipped] = useState(false)

  const measure = () => {
    const node = ref.current
    if (node) setClipped(node.scrollWidth > node.clientWidth)
  }

  useEffect(measure, [text])

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
          side={side}
          sideOffset={sideOffset}
          className="max-w-[min(40rem,var(--available-width,40rem))] text-sm font-normal break-words whitespace-normal"
        >
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
