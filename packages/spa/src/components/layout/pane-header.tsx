import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The bar a two-pane surface wears — the prototype's panes, the inbox and the
 * sessions list: a breadcrumb on the left, the subject's one-line context
 * beside it, and the pane's actions on the right.
 *
 * `foot` puts it along the bottom instead, where the code surfaces keep the
 * same trail — the pane's last line rather than its first. It stays ahead of the body in
 * the markup, so the trail is still read before what it describes.
 */
export function PaneHeader({
  crumbs,
  meta,
  actions,
  foot = false,
}: {
  crumbs: ReadonlyArray<ReactNode>;
  meta?: string;
  actions?: ReactNode;
  foot?: boolean;
}) {
  return (
    <header
      data-slot="pane-header"
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 px-3",
        foot
          ? "order-last border-t border-hairline"
          : "border-b border-hairline"
      )}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-[13px]"
      >
        {crumbs.map((crumb, index) => (
          <Fragment key={index}>
            {index > 0 && <span className="text-muted-foreground/50">/</span>}
            {crumb}
          </Fragment>
        ))}
      </nav>
      {meta !== undefined && (
        <p className="min-w-0 truncate text-xs text-muted-foreground max-lg:hidden">
          {meta}
        </p>
      )}
      {actions !== undefined && (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
        </div>
      )}
    </header>
  );
}

/** The roomy, centred column every pane's body lives in. */
export function PaneBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-5">{children}</div>;
}
