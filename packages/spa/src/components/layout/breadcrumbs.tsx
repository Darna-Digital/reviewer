/**
 * The title bar's trail — what is open and how you got there, so browsing a
 * file reads differently from stepping through history or a pull request.
 * Crumbs before the last one are links back to their level.
 */
import { IconChevronRight, type IconGitBranch } from "@tabler/icons-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  id: string;
  label: string;
  icon?: typeof IconGitBranch;
  /** Short mono prefix shown before the label, e.g. a commit's short sha. */
  hint?: string;
  /** Render the label in mono — used for file paths. */
  mono?: boolean;
  onClick?: () => void;
}

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
            {crumb.onClick !== undefined && !last ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="flex min-w-0 shrink items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
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
