/**
 * The furniture the window bar's controls share: the class that opts a control
 * out of the window's drag region, and the tooltip every one of them wears —
 * its name, and the chord that does the same thing set beside it in keycaps.
 *
 * Held apart from the bar so the strips drawn *on* it — the window's tabs, the
 * modes ahead of them — label themselves the same way without importing the bar
 * that renders them.
 */
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";

/** The chord that raises the project chip's dropdown, wherever it is drawn. */
export const PROJECT_PICKER_KEYS = "⌘⇧P";

/** Empty bar moves the window; every control on it opts back out. */
export const NO_DRAG = "[-webkit-app-region:no-drag]";

/** A chord as its keycaps: one per glyph, the way the style guide sets them. */
export function Shortcut({ keys }: { keys: string }) {
  return (
    <KbdGroup>
      {Array.from(keys).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

/** What the bar says about a control: its name, and the chord that runs it. */
export function BarLabel({
  label,
  keys,
}: {
  label: string;
  keys?: string | null;
}) {
  return (
    <TooltipContent side="bottom">
      {label}
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
