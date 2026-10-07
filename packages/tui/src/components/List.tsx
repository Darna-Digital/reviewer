import * as React from 'react';
import type { Palette } from '../render/palette';
import type { ListItem } from '../render/sidebarItems';
import type { Seg } from '../render/styled';
import { Line } from './Line';
import { useDoubleClick } from './useDoubleClick';

export interface ListProps {
  items: ListItem[];
  selected: number;
  focused: boolean;
  width: number;
  height: number;
  palette: Palette;
  emptyText: string;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  onScroll: (delta: number) => void;
}

/** Rows kept between the selection and the list's edge. */
const MARGIN = 2;
const WHEEL_STEP = 3;

/**
 * A list scrolled to keep its selection in view. Click selects,
 * double-click opens, the wheel moves the selection.
 */
export function List(props: ListProps) {
  const { items, selected, focused, width, height, palette } = props;
  const top = React.useRef(0);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const isDoubleClick = useDoubleClick();

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
      width,
    };
    for (const segs of item.rows(look)) rows.push({ segs, item: index });
    if (isSelected) selectedEnd = rows.length;
  });

  const margin = Math.min(MARGIN, Math.floor((height - 1) / 2));
  if (selectedStart - margin < top.current) {
    top.current = selectedStart - margin;
  } else if (selectedEnd + margin > top.current + height) {
    top.current = selectedEnd + margin - height;
  }
  top.current = Math.max(0, Math.min(top.current, rows.length - height));

  if (items.length === 0) {
    return (
      <box width={width} height={height} backgroundColor={palette.frame}>
        <Line
          segs={[
            { text: `  ${props.emptyText}`, fg: palette.faint, italic: true },
          ]}
          width={width}
          fill={palette.frame}
        />
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={palette.frame}
      onMouseScroll={(event) => {
        if (event.scroll?.direction === 'up') props.onScroll(-WHEEL_STEP);
        if (event.scroll?.direction === 'down') props.onScroll(WHEEL_STEP);
      }}
      onMouseOut={() => setHovered(null)}
    >
      {rows.slice(top.current, top.current + height).map((row, i) => (
        <Line
          key={top.current + i}
          segs={row.segs}
          width={width}
          fill={palette.frame}
          onMouseOver={() =>
            setHovered(items[row.item]?.selectable ? row.item : null)
          }
          onMouseDown={() => {
            const item = items[row.item];
            if (!item?.selectable) return;
            if (isDoubleClick(item.key)) props.onActivate(row.item);
            else props.onSelect(row.item);
          }}
        />
      ))}
    </box>
  );
}
