import { cardWidth } from './buildLayout';
import type { Geometry, Side, Stop, ViewMode } from './buildLayout';

export interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
}

export interface PlacementInput {
  /** The line (or card) the popover belongs to. */
  stop: Stop;
  /** First row of the pane on screen, and the pane's scroll offset. */
  paneTop: number;
  scrollTop: number;
  paneLeft: number;
  paneWidth: number;
  geometry: Geometry;
  view: ViewMode;
  side: Side;
  height: number;
  /** Rows the popover may use: from the top rail to the status bar. */
  screen: { top: number; bottom: number };
  /** Editing sits on the card itself rather than under the line. */
  over: boolean;
}

/**
 * Where an inline comment popover opens: under its line, lined up with the
 * comment cards, or above the line when there is no room under it.
 */
export function popoverPlacement(input: PlacementInput): PopoverPlacement {
  const { stop, geometry, screen, height } = input;
  const split = input.view === 'split';
  const room = split ? geometry.half : input.paneWidth;
  const offset = split && input.side === 'additions' ? geometry.half + 1 : 0;
  const left = input.paneLeft + offset + geometry.gutter;
  const width = Math.min(
    cardWidth(geometry, room),
    input.paneLeft + input.paneWidth - left,
  );

  const lineTop = input.paneTop + stop.row - input.scrollTop;
  const below = lineTop + (input.over ? 0 : stop.height);
  const above = lineTop - height;
  const fitsBelow = below + height <= screen.bottom;
  const top = fitsBelow
    ? below
    : above >= screen.top
      ? above
      : Math.max(screen.top, screen.bottom - height);
  return { left, top, width: Math.max(16, width) };
}
