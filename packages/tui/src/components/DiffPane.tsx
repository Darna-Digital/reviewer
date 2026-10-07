import type { MouseEvent } from '@opentui/core';
import type { Row } from '../diff/buildLayout';
import type { DiffView } from '../app/useDiffView';
import { paintFileHeader, paintRow } from '../render/diffRows';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { useDoubleClick } from './useDoubleClick';

export interface DiffPaneProps {
  view: DiffView;
  width: number;
  height: number;
  /** Pin the current file's header once its own has scrolled away. */
  sticky: boolean;
}

const WHEEL_STEP = 3;
const CHEVRON_CELLS = 4;

/** A virtualized diff or file: only the rows in view are drawn. */
export function DiffPane({ view, width, height, sticky }: DiffPaneProps) {
  const app = useAppContext();
  const { palette } = app;
  const isDoubleClick = useDoubleClick();
  const { rows, stops } = view.layout;
  const visible = rows.slice(view.top, view.top + height);
  const cursor = view.stop
    ? [view.stop.row, view.stop.row + view.stop.height]
    : [-1, -1];
  const pinned = sticky ? stickyFile(rows[view.top]) : null;

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={palette.island}
      onMouseScroll={(event) => {
        if (event.scroll?.direction === 'up') view.scrollBy(-WHEEL_STEP);
        if (event.scroll?.direction === 'down') view.scrollBy(WHEEL_STEP);
      }}
    >
      {visible.map((row, i) => {
        const index = view.top + i;
        if (i === 0 && pinned !== null) {
          return (
            <Line
              key="sticky"
              segs={paintFileHeader(view.paint, pinned, false)}
              width={width}
              onMouseDown={() => view.jumpToFile(pinned)}
            />
          );
        }
        return (
          <Line
            key={index}
            segs={paintRow(
              view.paint,
              row,
              index >= cursor[0]! && index < cursor[1]!,
            )}
            width={width}
            fill={palette.island}
            onMouseDown={(event) => click(index, event)}
          />
        );
      })}
      <box flexGrow={1} backgroundColor={palette.island} />
    </box>
  );

  function click(rowIndex: number, event: MouseEvent) {
    app.actions.setFocus('main');
    const index = view.stopAtRow(rowIndex);
    const stop = stops[index];
    if (!stop) return;
    const x = event.x - app.layout.mainLeft;
    if (view.view === 'split')
      view.setSide(x > view.layout.geometry.half ? 'right' : 'left');
    view.moveTo(index);

    const isDouble = isDoubleClick(stop.key);
    const file = view.paint.files[stop.file];
    if (stop.target.kind === 'file' && file && (isDouble || x < CHEVRON_CELLS))
      view.toggleFold(file);
    else if (stop.target.kind === 'comment' && isDouble)
      app.actions.editComment(stop.target.comment);
    else if (stop.target.kind === 'line' && isDouble) app.actions.compose();
  }
}

function stickyFile(row: Row | undefined): number | null {
  if (!row || row.kind === 'file' || row.kind === 'spacer') return null;
  return row.file;
}
