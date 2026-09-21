/**
 * The controls a window bar is made of: a square ghost button, and the tooltip
 * that names it.
 *
 * Shared by the two bars that carry the tab strip — the window bar of the
 * browser tab, and the bar the macOS shell's code island draws along its own
 * top edge — so the buttons either side of the strip read
 * the same wherever the strip is.
 */
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Opts a control out of the native window's drag region. */
export const NO_DRAG = "[-webkit-app-region:no-drag]";

/**
 * What the bar says about a control: its name. A long tab title is cut at the
 * tooltip's own width rather than wrapped.
 */
export function BarLabel({ label }: { label: string }) {
  return (
    <TooltipContent side="bottom">
      <span className="min-w-0 truncate">{label}</span>
    </TooltipContent>
  );
}

export function BarTooltip({
  label,
  children,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip disabled={disabled}>
      {children}
      <BarLabel label={label} />
    </Tooltip>
  );
}

export function BarButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Set on toggles, so the button both announces and shows its state. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <BarTooltip label={label}>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "text-muted-foreground",
              pressed === true && "bg-elevate-strong text-foreground",
              NO_DRAG
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
    </BarTooltip>
  );
}
