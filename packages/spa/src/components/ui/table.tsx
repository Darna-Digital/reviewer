/**
 * The table sheet.
 *
 * A table here is not a grid drawn on the page — it is a sheet of paper lying
 * on it, with the column labels left behind on the page itself. That is the
 * whole of the look: the header sits on `--table-surface` and the rows sit on
 * `--table-sheet`, a step lighter (a step darker, in dark), edged with a
 * hairline and lifted by a ring and two soft drops.
 *
 * The body is deliberately open at the foot: it is inset by half a hairline on
 * three sides and runs past the container's bottom edge, which the container's
 * own `overflow-hidden` clips to its radius. So the sheet's bottom corners are
 * rounded by the crop rather than by a border, and the last row never has a
 * line drawn under it — the sheet simply ends.
 *
 * Rows are flex rather than `<table>` markup, because every table in this app
 * is a list of records with equal columns and at least one interactive row;
 * `<tr>` cannot be a button, and column widths that come from content are a
 * liability in a resizable pane. `role` attributes carry the semantics that the
 * markup no longer states. Markdown tables, which are real table markup by the
 * time we see them, get the same look from `markdown-table.tsx`.
 */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* The sheet wears the app's own radius, so a table and a chat box read as the
   same kind of object rather than two different ones. */
const RADIUS = "rounded-lg";

export function Table({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      role="table"
      className={cn(
        "flex w-full max-w-full flex-col overflow-hidden text-[13px]",
        RADIUS,
        "bg-table-surface shadow-table",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableHead({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      role="rowgroup"
      className={cn(
        "flex font-medium text-table-head-ink [&_[data-table-cell]]:py-[7px]",
        className
      )}
      {...props}
    >
      <div role="row" className="flex min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      role="rowgroup"
      className={cn(
        "-mx-[0.5px] -mb-[0.5px] flex flex-col rounded-t-lg border-[0.5px] border-table-line bg-table-sheet",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const ROW =
  "flex w-full text-left [&:not(:last-child)]:border-b-[0.5px] [&:not(:last-child)]:border-table-line";

type TableRowProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & ComponentProps<"button">;

/**
 * A row is a button when it goes somewhere and a plain row when it does not,
 * so the hit target is the row itself rather than a link buried in one cell.
 */
export function TableRow({
  className,
  children,
  onClick,
  ...props
}: TableRowProps) {
  if (onClick === undefined) {
    return (
      <div role="row" className={cn(ROW, className)}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      role="row"
      onClick={onClick}
      className={cn(ROW, "cursor-default hover:bg-hover", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      role="cell"
      data-table-cell=""
      className={cn(
        "flex min-w-0 flex-1 basis-0 items-center overflow-hidden px-3 py-[9px] whitespace-nowrap text-table-ink",
        "[&:not(:last-child)]:border-r-[0.5px] [&:not(:last-child)]:border-table-line",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * `text-overflow: ellipsis` does nothing to the raw text of a flex container,
 * so a label that has to truncate lives in this shrinkable child instead.
 */
export function TableCellText({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("min-w-0 truncate", className)} {...props}>
      {children}
    </span>
  );
}
