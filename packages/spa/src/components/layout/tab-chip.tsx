/**
 * The shape every tab strip in the app shares: a rounded chip that leads with an
 * icon, names itself, and keeps a fixed slot at its tail for the ✕ — so a tab
 * neither resizes nor leaves a hole as the control comes and goes.
 *
 * The window bar's own strip is the reference; the strips beneath it — the
 * open files in code, the prototype's open surfaces — wear the same chip so
 * moving between them is a change of contents, not of furniture.
 *
 * In the macOS shell the chip is the toolbar's: a capsule, with a round ✕ in
 * its tail, the shape the native window tabs above it are cut to (see
 * `BarChipStyle` and `TabCloseButton` in the macOS app), so the open files
 * under the shell's own tabs read as one strip on two lines rather than two
 * strips of different furniture.
 */
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const tabChipClass = (active: boolean, dragging = false) =>
  cn(
    "group/tab flex h-7 max-w-56 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-md pr-1.5 pl-2.5 text-[0.8125rem] transition-colors",
    "island:rounded-full island:pl-3",
    active
      ? "bg-elevate-strong text-foreground"
      : "text-muted-foreground hover:bg-elevate hover:text-foreground",
    dragging && "opacity-50"
  );

/**
 * A strip of those chips. It scrolls, but without a scrollbar: the bar is drawn
 * inside a band only a tab tall, where it cuts across the chips and the rule
 * under them. The edges fade instead — and only the edge that still has tabs
 * behind it, so the fade is the count of what is out of sight rather than a
 * decoration on both ends.
 */
export const TAB_STRIP = cn(
  "flex min-w-0 items-center gap-1 overflow-x-auto",
  "scrollbar-none",
  // Narrower than the utility's default: a tab is not a page, and a 48px fade
  // would swallow the icon and half the name of the tab it lands on.
  "scroll-fade-when-scrollable scroll-fade-x [--scroll-fade-size:1.5rem]"
);

export function TabClose({
  label,
  active,
  dirty = false,
  onClose,
}: {
  readonly label: string;
  readonly active: boolean;
  /** An unsaved buffer takes the slot as a dot, and gives it back on hover. */
  readonly dirty?: boolean;
  readonly onClose: () => void;
}) {
  return (
    <span className="relative flex size-[1.125rem] shrink-0 items-center justify-center">
      {dirty && (
        <span
          aria-label="Unsaved changes"
          className="size-1.5 rounded-full bg-primary group-hover/tab:opacity-0"
        />
      )}
      <button
        type="button"
        aria-label={label}
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded hover:bg-elevate-strong island:rounded-full",
          active && !dirty
            ? "opacity-70"
            : "opacity-0 group-hover/tab:opacity-70"
        )}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <IconX className="size-3.5" />
      </button>
    </span>
  );
}
