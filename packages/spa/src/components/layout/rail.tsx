/**
 * The rail — the column of icons down the left of the app, and the buttons that
 * go in it.
 *
 * What a rail carries is its surface's own business; the column is not. Its
 * width, its inset, the gap between its buttons and the edge drawn down its
 * last pixel are held here so that every surface with a rail has the *same*
 * one, and moving between them moves only what is in it. Two surfaces each
 * drawing their own column is how the page beneath ends up stepping sideways on
 * the way across.
 *
 * It measures 36px — the same as the window bar's band, the header's, and the
 * tab strip's inside its rule — with a 28px button in it, the square the
 * project chip beside it and the tabs above it are. It has no edge of its own:
 * it stands on the frame rather than being a sheet, and the seam between it and
 * the column beside it is the frame showing through.
 */
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

export function Rail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="relative flex h-full w-9 shrink-0 flex-col items-center py-1"
    >
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {children}
      </div>
    </nav>
  );
}

/** The buttons a rail pushes to its foot, clear of the ones at its head. */
export function RailFoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex flex-col items-center gap-1">{children}</div>
  );
}

export function RailButton({
  label,
  active,
  onClick,
  onPointerEnter,
  onFocus,
  to,
  render,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** Where a button navigates, this is how it preloads on intent — the same
   * moment a `Link` beside it would. */
  onPointerEnter?: () => void;
  onFocus?: () => void;
  to?: string;
  /** The control the button is, where it is neither a link nor a plain button —
   * a popover's trigger, say, which has to be the element the popup hangs off. */
  render?: React.ReactElement;
  children: React.ReactNode;
}) {
  /* A rail is a column of icons with no labels under them, so where a list can
     say which row is selected by one difference, this has to say it by three at
     once: the chip it sits in, the weight of its ink, and the weight of the
     stroke the icon is drawn with. A tint alone was the whole of it before, and
     on the frame the rail stands on, that tint was very nearly the frame. */
  const className = cn(
    buttonVariants({
      variant: active === true ? "selected" : "ghost",
      size: "icon-sm",
    }),
    "relative [-webkit-app-region:no-drag]",
    active === true
      ? "[&_svg]:stroke-2"
      : "text-muted-foreground hover:text-foreground [&_svg]:stroke-[1.5]"
  );
  return (
    <Tooltip>
      <TooltipTrigger
        className={className}
        aria-label={label}
        onPointerEnter={onPointerEnter}
        onFocus={onFocus}
        render={
          render ??
          (to !== undefined ? (
            <Link to={to} onClick={onClick} />
          ) : (
            <button type="button" onClick={onClick} />
          ))
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Bring the shell's sidebar back, for the rail buttons that act on it.
 *
 * Some of what the rail carries is a control for the column beside it rather
 * than for the pane: the surfaces whose left column *is* the sidebar, the
 * filters that narrow the list in it. The sidebar is put away by dragging its
 * edge shut (see `SidebarResizeHandle`), which leaves the rail standing with
 * its column gone — and pressing one of those is then a click that changes
 * nothing you can see. Reaching for a control that acts on the sidebar is
 * asking to be looking at the sidebar, so it opens.
 */
export function revealSidebar() {
  setUiPrefs({ sidebarVisible: true });
}
