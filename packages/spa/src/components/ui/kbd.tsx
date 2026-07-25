import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-md px-1.5 font-sans text-[0.6875rem] font-medium",
        "bg-muted text-muted-foreground ring-1 ring-foreground/10",
        "[&_svg:not([class*='size-'])]:size-3",
        // Inside tooltips: slightly recessed keycaps on the elevated surface.
        "[[data-slot=tooltip-content]_&]:bg-foreground/[0.06] [[data-slot=tooltip-content]_&]:text-muted-foreground [[data-slot=tooltip-content]_&]:ring-foreground/10",
        "dark:[[data-slot=tooltip-content]_&]:bg-background/45 dark:[[data-slot=tooltip-content]_&]:ring-white/12",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn(
        "inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
