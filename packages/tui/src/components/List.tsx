import * as React from 'react';
import type { ListItem } from '../render/listItems';
import type { Palette } from '../render/palette';
import { sliceSegs } from '../render/styled';
import type { Seg } from '../render/styled';
import { Line } from './Line';
import { useDoubleClick } from './useDoubleClick';
import { useWheel } from './useWheel';

export interface ListProps<TValue> {
  items: Array<ListItem<TValue>>;
  selected: number;
  focused: boolean;
  width: number;
  height: number;
  palette: Palette;
  emptyText: string;
  onSelect: (item: ListItem<TValue>, index: number) => void;
  onActivate?: (item: ListItem<TValue>, index: number) => void;
  /** Right-click, with the screen position for a context menu. */
  onContextMenu?: (
    item: ListItem<TValue>,
    at: { x: number; y: number },
  ) => void;
  /** Clicks on rows that are not selectable (headings). */
  onHeading?: (item: ListItem<TValue>) => void;
  onScroll?: (delta: number) => void;
  bg?: string;
  /** Rows laid out this wide and scrolled sideways by `scrollX`. */
  contentWidth?: number;
  scrollX?: number;
  onScrollX?: (delta: number) => void;
}

const MARGIN = 2;
const RIGHT_BUTTON = 2;

/**
 * A virtualized list scrolled to keep its selection in view. Click selects,
 * double-click activates, right-click asks for a context menu.
 */
export function List<TValue>(props: ListProps<TValue>) {
  const { items, selected, focused, width, height, palette } = props;
  const bg = props.bg ?? palette.frame;
  const top = React.useRef(0);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const isDoubleClick = useDoubleClick();
  const wheel = useWheel((rows) => props.onScroll?.(rows), props.onScrollX);

  const rows: Array<{ segs: Seg[]; item: number }> = [];
  let selectedStart = 0;
  let selectedEnd = 0;
  items.forEach((item, index) => {
    const isSelected = index === selected;
    if (isSelected) selectedStart = rows.length;
    const look = {
      selected: isSelected,
      focused,
      hovered: index === hovered,
      width: props.contentWidth ?? width,
    };
    for (const segs of item.rows(look)) rows.push({ segs, item: index });
    if (isSelected) selectedEnd = rows.length;
  });

  const margin = Math.min(MARGIN, Math.floor((height - 1) / 2));
  if (selectedStart - margin < top.current)
    top.current = selectedStart - margin;
  else if (selectedEnd + margin > top.current + height)
    top.current = selectedEnd + margin - height;
  top.current = Math.max(0, Math.min(top.current, rows.length - height));

  if (items.length === 0) {
    return (
      <box width={width} height={height} backgroundColor={bg}>
        <Line
          segs={[
            { text: `  ${props.emptyText}`, fg: palette.faint, italic: true },
          ]}
          width={width}
          fill={bg}
        />
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={bg}
      onMouseScroll={wheel}
      onMouseOut={() => setHovered(null)}
    >
      {rows.slice(top.current, top.current + height).map((row, i) => (
        <Line
          key={top.current + i}
          segs={sliceSegs(row.segs, props.scrollX ?? 0, width, bg)}
          width={width}
          fill={bg}
          onMouseOver={() =>
            setHovered(items[row.item]?.selectable ? row.item : null)
          }
          onMouseDown={(event) => {
            const item = items[row.item];
            if (!item) return;
            if (!item.selectable) return props.onHeading?.(item);
            if (event.button === RIGHT_BUTTON) {
              props.onSelect(item, row.item);
              props.onContextMenu?.(item, { x: event.x, y: event.y });
            } else if (isDoubleClick(item.key)) {
              props.onActivate?.(item, row.item);
            } else {
              props.onSelect(item, row.item);
            }
          }}
        />
      ))}
      <box flexGrow={1} backgroundColor={bg} />
    </box>
  );
}
