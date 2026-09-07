/**
 * GFM tables inside prose, wearing the same sheet as `ui/table.tsx`.
 *
 * These arrive as real `<table>` markup from remark-gfm, so the look has to be
 * rebuilt out of cell borders: in the separated-borders model a border on
 * `<tbody>` is never painted, which means the sheet's own edge is the top
 * border of the first row and the outer borders of the cells on its rim.
 *
 * The wrapper is what carries the radius and the crop, so a table wider than
 * the column scrolls inside the sheet rather than pushing the prose open, and
 * the last row's bottom corners are rounded by that crop — the body has no
 * bottom border, exactly as in the flex version.
 */
import type { Components } from "react-markdown";

export const MARKDOWN_TABLE_COMPONENTS = {
  table: ({ node: _node, className: _className, ...props }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-[12px] bg-table-surface shadow-table">
      <table
        className="w-full border-separate border-spacing-0 text-[13px] [&_tbody_tr:first-child_td:first-child]:rounded-tl-[12px] [&_tbody_tr:first-child_td:last-child]:rounded-tr-[12px]"
        {...props}
      />
    </div>
  ),
  th: ({ node: _node, className: _className, ...props }) => (
    <th
      className="border-table-line px-3 py-[7px] text-left font-medium whitespace-nowrap text-table-head-ink [&:not(:last-child)]:border-r-[0.5px]"
      {...props}
    />
  ),
  td: ({ node: _node, className: _className, ...props }) => (
    <td
      className="border-t-[0.5px] border-r-[0.5px] border-table-line bg-table-sheet px-3 py-[9px] align-middle whitespace-nowrap text-table-ink first:border-l-[0.5px]"
      {...props}
    />
  ),
} satisfies Components;
