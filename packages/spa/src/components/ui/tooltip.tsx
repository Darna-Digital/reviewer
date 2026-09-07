"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";
import { ELEVATION, POPUP_SHADOW, useElevation } from "@/lib/surface-context";
import {
  HIDDEN_WITH_ANCHOR,
  useDismissOnUserScroll,
} from "@/components/ui/anchored-popup";

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip({
  actionsRef,
  onOpenChange,
  ...props
}: TooltipPrimitive.Root.Props) {
  const ownActions = React.useRef<TooltipPrimitive.Root.Actions | null>(null);
  const actions = actionsRef ?? ownActions;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    props.defaultOpen ?? false
  );
  useDismissOnUserScroll(props.open ?? uncontrolledOpen, () =>
    actions.current?.close()
  );

  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      {...props}
      actionsRef={actions}
      onOpenChange={(open, details) => {
        setUncontrolledOpen(open);
        onOpenChange?.(open, details);
      }}
    />
  );
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const { className: surface } = useElevation(ELEVATION.tooltip, POPUP_SHADOW);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate z-50", HIDDEN_WITH_ANCHOR)}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-medium text-popover-foreground",
            // Lifts a rung further than a menu: a tooltip has to stay legible
            // over whatever popup triggered it.
            surface,
            "has-data-[slot=kbd]:pr-1.5 has-data-[slot=kbd-group]:pr-1.5",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
