import { cn } from "@/lib/utils";

/**
 * One key of a chord.
 *
 * Every cap is the same 20px square, whatever glyph it holds: ⇧ and ⌘ are far
 * wider than a letter, and padding around them made a chord read as keys of
 * assorted sizes rather than as a row. Only a cap spelling a word — `esc` —
 * grows, and it grows from that square.
 *
 * The fill is the substrate-relative tint, so a cap sits a rung above whatever
 * it lands on — a tooltip, a menu, the dialog's footer — and needs no ring to
 * draw its edge. It was a fixed colour with a ring before, which is why it had
 * a second set of colours for tooltips and still read as a box drawn on top of
 * one rather than as part of it.
 */
function Kbd({ className, children, ...props }: React.ComponentProps<"kbd">) {
  const spelled = typeof children === "string" && children.length > 1;
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 items-center justify-center gap-1 rounded-sm font-sans text-[0.6875rem] font-medium select-none",
        spelled ? "min-w-5 px-1.5" : "w-5",
        // The tint that lifts the cap in dark lands near the muted grey the
        // glyph is set in, so dark sets the glyph brighter rather than the cap
        // darker: a recessed key is what made the old dark caps read as holes.
        "bg-elevate-strong text-muted-foreground dark:text-foreground/85",
        "[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
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
  );
}

export { Kbd, KbdGroup };
