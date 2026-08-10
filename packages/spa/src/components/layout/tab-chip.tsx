/**
 * The shape every tab strip in the app shares: a rounded chip that leads with an
 * icon, names itself, and keeps a fixed slot at its tail for the ✕ — so a tab
 * neither resizes nor leaves a hole as the control comes and goes.
 *
 * The window bar's own strip is the reference; the mode strips beneath it —
 * open files in code, open surfaces in collaboration — wear the same chip so
 * moving between modes is a change of contents, not of furniture.
 */
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const tabChipClass = (active: boolean, dragging = false) =>
  cn(
    "group/tab flex h-8 max-w-56 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-md pr-1.5 pl-2.5 text-[0.8125rem] transition-colors",
    active
      ? "bg-elevate-strong text-foreground"
      : "text-muted-foreground hover:bg-elevate hover:text-foreground",
    dragging && "opacity-50"
  );

export const TAB_STRIP = "flex min-w-0 items-center gap-1 overflow-x-auto";

export function TabClose({
  label,
  active,
  onClose,
  children,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClose: () => void;
  /** Sits under the ✕ and shows through until the tab is hovered or active. */
  readonly children?: React.ReactNode;
}) {
  return (
    <span className="relative flex size-[1.125rem] shrink-0 items-center justify-center">
      {children}
      <button
        type="button"
        aria-label={label}
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded hover:bg-elevate-strong",
          active ? "opacity-70" : "opacity-0 group-hover/tab:opacity-70"
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
