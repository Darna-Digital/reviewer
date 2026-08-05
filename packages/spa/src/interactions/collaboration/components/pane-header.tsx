import { Fragment, type ReactNode } from "react"

/**
 * The header every collaboration pane wears: a breadcrumb on the left, the
 * subject's one-line context beside it, and the pane's actions on the right.
 */
export function PaneHeader({
  crumbs,
  meta,
  actions,
}: {
  crumbs: ReadonlyArray<ReactNode>
  meta?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
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
  )
}

/** The roomy, centred column every pane's body lives in. */
export function PaneBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-5">{children}</div>
}
