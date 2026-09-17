/**
 * The controls a window bar is made of: a square ghost button, and the tooltip
 * that names it and says which chord does the same.
 *
 * Shared by the two bars that carry the tab strip — the window bar of the
 * browser and the Electron window, and the bar the macOS shell's code island
 * draws along its own top edge — so the buttons either side of the strip read
 * the same wherever the strip is.
 */
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Opts a control out of the native window's drag region. */
export const NO_DRAG = "[-webkit-app-region:no-drag]";

/** A chord as its keycaps: one per glyph, the way the style guide sets them. */
export function Shortcut({ keys }: { keys: string }) {
  return (
    <KbdGroup className="shrink-0">
      {Array.from(keys).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

/**
 * What the bar says about a control: its name, and the chord that runs it.
 *
 * A long tab title is cut at the tooltip's own width rather than wrapped: the
 * chord sits at the end of the line, and a second line of title pushed it away
 * from the name it belongs to.
 */
export function BarLabel({
  label,
  keys,
}: {
  label: string;
  keys?: string | null;
}) {
  return (
    <TooltipContent side="bottom">
      <span className="min-w-0 truncate">{label}</span>
      {keys != null && <Shortcut keys={keys} />}
    </TooltipContent>
  );
}

export function BarTooltip({
  label,
  keys,
  children,
  disabled,
}: {
  label: string;
  keys?: string | null;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip disabled={disabled}>
      {children}
      <BarLabel label={label} keys={keys} />
    </Tooltip>
  );
}

export function BarButton({
  label,
  keys,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  /** The chord that does the same thing, set in keycaps beside the label. */
  keys?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Set on toggles, so the button both announces and shows its state. */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <BarTooltip label={label} keys={keys}>
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
