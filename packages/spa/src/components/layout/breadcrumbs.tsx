/**
 * The trail — what is open and how you got there, so browsing a file reads
 * differently from stepping through history or a pull request. Crumbs before
 * the last one are links back to their level, and a crumb can instead carry a
 * dropdown of what else sits at its level.
 *
 * A crumb that opens a menu wears a chevron, because that is the only thing
 * telling it apart from one that merely says where you are — and it is the same
 * chevron, at the same size, that the branch picker beside it wears, since they
 * are the same offer.
 *
 * `md` builds them to the picker's measure for the header row; `sm` is the
 * caption along the foot of a pane. Same trail, sized to its company.
 */
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Fragment, type ReactNode, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface Crumb {
  id: string;
  label: string;
  /** Leading glyph, sized by the trail rather than by the caller. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Short mono prefix shown before the label, e.g. a commit's short sha. */
  hint?: string;
  /** Render the label in mono — used for file paths. */
  mono?: boolean;
  onClick?: () => void;
  /** Menu items, built only once the crumb's dropdown opens. */
  menu?: () => ReactNode;
}

export type CrumbSize = "sm" | "md";

/** Built to the branch picker's chip at `md`, so a row of them reads as one. */
const METRICS: Readonly<
  Record<CrumbSize, { trail: string; crumb: string; glyph: string }>
> = {
  sm: {
    trail: "gap-0.5 text-xs",
    crumb: "h-6 gap-1 px-1.5",
    glyph: "size-3",
  },
  md: {
    trail: "gap-1 text-sm",
    crumb: "h-7 gap-1.5 px-2",
    glyph: "size-3.5",
  },
};

const interactiveCrumb =
  "flex min-w-0 shrink items-center rounded-md outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

export function Breadcrumbs({
  crumbs,
  size = "sm",
}: {
  crumbs: ReadonlyArray<Crumb>;
  size?: CrumbSize;
}) {
  const metrics = METRICS[size];
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 items-center", metrics.trail)}
    >
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        const Icon = crumb.icon;
        const content = (
          <>
            {Icon && (
              <Icon
                className={cn("shrink-0 text-muted-foreground", metrics.glyph)}
              />
            )}
            {crumb.hint !== undefined && (
              <span className="shrink-0 font-mono opacity-70">
                {crumb.hint}
              </span>
            )}
            <span className={cn("truncate", crumb.mono && "font-mono")}>
              {crumb.label}
            </span>
            {crumb.menu !== undefined && (
              <IconChevronDown
                className={cn("shrink-0 text-muted-foreground", metrics.glyph)}
              />
            )}
          </>
        );
        return (
          <Fragment key={crumb.id}>
            {index > 0 && (
              <IconChevronRight
                className={cn(
                  "shrink-0 text-muted-foreground/50",
                  metrics.glyph
                )}
              />
            )}
            {crumb.menu !== undefined ? (
              <CrumbMenu crumb={crumb} last={last} className={metrics.crumb}>
                {content}
              </CrumbMenu>
            ) : crumb.onClick !== undefined && !last ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className={cn(
                  interactiveCrumb,
                  metrics.crumb,
                  "text-muted-foreground"
                )}
              >
                {content}
              </button>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={cn(
                  "flex min-w-0 shrink items-center",
                  metrics.crumb,
                  last ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {content}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function CrumbMenu({
  crumb,
  last,
  className,
  children,
}: {
  crumb: Crumb;
  last: boolean;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-current={last ? "page" : undefined}
        className={cn(
          interactiveCrumb,
          className,
          "cursor-default",
          last ? "font-medium text-foreground" : "text-muted-foreground"
        )}
        render={<button type="button" />}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(60vh,24rem)] max-w-72 min-w-56 overflow-y-auto"
      >
        {open && crumb.menu?.()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
