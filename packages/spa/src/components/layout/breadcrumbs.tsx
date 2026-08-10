/**
 * The trail along the foot of the centre pane — what is open and how you got
 * there, so browsing a file reads differently from stepping through history or
 * a pull request. Crumbs before the last one are links back to their level, and
 * a crumb can instead carry a dropdown of what else sits at its level; the
 * trail is the pane's last line, so those open upwards.
 */
import { IconChevronRight } from "@tabler/icons-react";
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

const interactiveCrumb =
  "flex min-w-0 shrink items-center gap-1 rounded-md px-1.5 py-0.5 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

export function Breadcrumbs({ crumbs }: { crumbs: ReadonlyArray<Crumb> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-0.5 text-xs"
    >
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        const Icon = crumb.icon;
        const content = (
          <>
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {crumb.hint !== undefined && (
              <span className="shrink-0 font-mono text-[11px] opacity-70">
                {crumb.hint}
              </span>
            )}
            <span className={cn("truncate", crumb.mono && "font-mono")}>
              {crumb.label}
            </span>
          </>
        );
        return (
          <Fragment key={crumb.id}>
            {index > 0 && (
              <IconChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
            )}
            {crumb.menu !== undefined ? (
              <CrumbMenu crumb={crumb} last={last}>
                {content}
              </CrumbMenu>
            ) : crumb.onClick !== undefined && !last ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className={cn(interactiveCrumb, "text-muted-foreground")}
              >
                {content}
              </button>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={cn(
                  "flex min-w-0 shrink items-center gap-1 px-1.5 py-0.5",
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
  children,
}: {
  crumb: Crumb;
  last: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-current={last ? "page" : undefined}
        className={cn(
          interactiveCrumb,
          "cursor-default",
          last ? "font-medium text-foreground" : "text-muted-foreground"
        )}
        render={<button type="button" />}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="max-h-[min(60vh,24rem)] max-w-72 min-w-56 overflow-y-auto"
      >
        {open && crumb.menu?.()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
