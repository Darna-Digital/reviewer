import * as React from "react";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import {
  HIDDEN_WITH_ANCHOR,
  useDismissOnUserScroll,
} from "@/components/ui/anchored-popup";

function PreviewCard({
  actionsRef,
  onOpenChange,
  ...props
}: PreviewCardPrimitive.Root.Props) {
  const ownActions = React.useRef<PreviewCardPrimitive.Root.Actions | null>(
    null
  );
  const actions = actionsRef ?? ownActions;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    props.defaultOpen ?? false
  );
  useDismissOnUserScroll(props.open ?? uncontrolledOpen, () =>
    actions.current?.close()
  );

  return (
    <PreviewCardPrimitive.Root
      data-slot="preview-card"
      {...props}
      actionsRef={actions}
      onOpenChange={(open, details) => {
        setUncontrolledOpen(open);
        onOpenChange?.(open, details);
      }}
    />
  );
}

function PreviewCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />
  );
}

function PreviewCardContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "right",
  sideOffset = 8,
  children,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const { level, className: surface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate z-50", HIDDEN_WITH_ANCHOR)}
      >
        <PreviewCardPrimitive.Popup
          data-slot="preview-card-content"
          data-surface={level}
          className={cn(
            "z-50 flex w-64 origin-(--transform-origin) flex-col gap-1.5 rounded-md p-3 text-sm text-popover-foreground outline-hidden",
            surface,
            className
          )}
          {...props}
        >
          <SurfaceProvider value={level}>{children}</SurfaceProvider>
        </PreviewCardPrimitive.Popup>
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { PreviewCard, PreviewCardTrigger, PreviewCardContent };
