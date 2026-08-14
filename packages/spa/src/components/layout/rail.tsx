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
 * Its buttons are the header's square — the same size as the project chip
 * beside them, inset by the same amount the header's own centring gives that
 * chip — so the first one in the column reads as part of the row it starts.
 */
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      {/* The rail's right edge is drawn over its last pixel column rather than
          as a `border-r`, which would take that pixel out of the content box
          and centre every icon half a pixel left of where the toolbar's own
          `px-2` puts them — the icons visibly stepping sideways on the way in
          and out of collaboration mode, which has no rail. */}
      <div className="absolute top-0 right-0 h-full w-px bg-border" />
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
  const className = cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "relative text-muted-foreground [-webkit-app-region:no-drag]",
    active === true && "bg-muted text-foreground"
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
