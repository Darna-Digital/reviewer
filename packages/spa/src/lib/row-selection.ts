/**
 * Range selection over a keyed list of rows — the sessions sidebar today, any
 * list of rows tomorrow: a plain click starts a selection on the row it lands
 * on, and a shift-click sweeps the run between that row and this one.
 *
 * The anchor is what a sweep is measured from, and it survives the sweep, so
 * shift-clicking again re-measures from the same row rather than growing
 * whatever was last selected — dragging the far end of a range back and forth
 * is the same gesture repeated, not a selection that only ever gets bigger.
 *
 * Which click means what is the list's own business; this only says what the
 * selection becomes.
 */

export interface RowSelection {
  readonly ids: ReadonlySet<string>;
  readonly anchor: string | null;
}

export const NO_ROWS: RowSelection = { ids: new Set<string>(), anchor: null };

export const selectRow = (id: string): RowSelection => ({
  ids: new Set([id]),
  anchor: id,
});

/**
 * A plain click, where a row is opened rather than picked: nothing is
 * selected, but the row is where a shift-click after it sweeps from — which is
 * what makes "open one, shift-click the other" select the run between them.
 */
export const anchorRow = (id: string): RowSelection => ({
  ids: new Set<string>(),
  anchor: id,
});

/**
 * A shift-click: everything between the anchor and `id`, inclusive. With no
 * anchor to measure from — nothing selected yet, or the anchor scrolled out of
 * the list it was taken in — the click is the plain one it would have been.
 */
export function extendToRow(
  order: ReadonlyArray<string>,
  selection: RowSelection,
  id: string
): RowSelection {
  const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);
  if (from === -1 || to === -1) return selectRow(id);
  const [start, end] = from <= to ? [from, to] : [to, from];
  return {
    ids: new Set(order.slice(start, end + 1)),
    anchor: selection.anchor,
  };
}

/**
 * The selection as the list can act on it: only rows the list still holds, in
 * the order it holds them. A filtered or refetched list can drop rows out from
 * under a selection, and acting on ids that are no longer listed is acting on
 * rows the user can't see.
 */
export function selectedRows(
  order: ReadonlyArray<string>,
  selection: RowSelection
): ReadonlyArray<string> {
  return order.filter((id) => selection.ids.has(id));
}
