import * as React from 'react';

const MARGIN = 1;

/**
 * A list's own scroll position. The wheel moves it freely; it only follows
 * the selection when the selection itself moves out of view — so a row
 * picked up by hovering never shifts the list under the pointer.
 */
export function useScrollWindow(
  selected: number,
  count: number,
  height: number,
) {
  const top = React.useRef(0);
  const followed = React.useRef(-1);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const max = Math.max(0, count - height);

  if (selected !== followed.current) {
    followed.current = selected;
    const margin = Math.min(MARGIN, Math.floor((height - 1) / 2));
    if (selected - margin < top.current) top.current = selected - margin;
    else if (selected + margin >= top.current + height)
      top.current = selected + margin - height + 1;
  }
  top.current = Math.max(0, Math.min(top.current, max));

  return {
    top: top.current,
    scrollBy(rows: number) {
      const next = Math.max(0, Math.min(top.current + rows, max));
      if (next === top.current) return;
      top.current = next;
      redraw();
    },
  };
}
