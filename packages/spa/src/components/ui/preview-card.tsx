import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import { cn } from "@/lib/utils"

function PreviewCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />
}

function PreviewCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />
  )
}

function PreviewCardContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "right",
  sideOffset = 8,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="preview-card-content"
          className={cn(
            "z-50 flex w-64 origin-(--transform-origin) flex-col gap-1.5 rounded-xl bg-popover p-3 text-sm text-popover-foreground outline-hidden",
            "shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]",
            "dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]",
            "data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { PreviewCard, PreviewCardTrigger, PreviewCardContent }
