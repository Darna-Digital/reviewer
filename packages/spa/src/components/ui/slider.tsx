import type * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/**
 * A thin groove with a small square key, sized to sit in an inspector row
 * beside its number rather than to be a control on its own.
 */
function Slider({
  className,
  trackClassName,
  trackStyle,
  indicator = true,
  ...props
}: SliderPrimitive.Root.Props<number> & {
  /** For a track that is itself the value — a hue strip, an alpha ramp. */
  trackClassName?: string;
  trackStyle?: React.CSSProperties;
  indicator?: boolean;
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("flex min-w-0 flex-1 items-center", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex h-6 w-full touch-none items-center select-none">
        <SliderPrimitive.Track
          className={cn(
            "relative h-1 w-full rounded-full bg-elevate-strong",
            trackClassName
          )}
          style={trackStyle}
        >
          {indicator && (
            <SliderPrimitive.Indicator className="rounded-full bg-foreground/60" />
          )}
          <SliderPrimitive.Thumb className="size-3 rounded-[4px] border border-frame-border bg-background shadow-xs outline-offset-1 outline-ring focus-visible:outline-2" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
