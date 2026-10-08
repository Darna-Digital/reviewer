import type { MouseEvent } from '@opentui/core';
import type { Row } from '../diff/buildLayout';
import type { DiffView } from '../app/useDiffView';
import { codeAt } from '../diff/codeAt';
import { paintFileHeader, paintRow } from '../render/diffRows';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { useDoubleClick } from './useDoubleClick';
import { useWheel } from './useWheel';

export interface DiffPaneProps {
  view: DiffView;
  width: number;
  height: number;
  /** Pin the current file's header once its own has scrolled away. */
  sticky: boolean;
  /** Screen column the pane starts at; the editor's by default. */
  left?: number;
  /** Clicks give the editor the keyboard; off for a preview. */
  takesFocus?: boolean;
}

const CHEVRON_CELLS = 4;
const RIGHT_BUTTON = 2;

/** A virtualized diff or file: only the rows in view are drawn. */
export function DiffPane(props: DiffPaneProps) {
  const { view, width, height, sticky, takesFocus = true } = props;
  const app = useAppContext();
  const { palette } = app;
  const left = props.left ?? app.layout.mainLeft;
  const isDoubleClick = useDoubleClick();
  const wheel = useWheel(view.scrollBy, view.wrap ? undefined : view.scrollXBy);
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
      onMouseScroll={wheel}
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
            onMouseMove={(event) => hover(index, event)}
          />
        );
      })}
      <box flexGrow={1} backgroundColor={palette.island} />
    </box>
  );

  /** The symbol under the pointer, when the server can be asked about it. */
  function spotAt(rowIndex: number, event: MouseEvent) {
    const point = codeAt({
      row: rows[rowIndex],
      files: view.paint.files,
      geometry: view.layout.geometry,
      scrollX: view.scrollX,
      x: event.x - left,
    });
    return point ? app.actions.spotOf(view, point) : null;
  }

  function hover(rowIndex: number, event: MouseEvent) {
    app.symbols.hoverAt(spotAt(rowIndex, event), {
      x: event.x,
      y: event.y + 1,
    });
  }

  function click(rowIndex: number, event: MouseEvent) {
    app.symbols.hideHover();
    const spot = spotAt(rowIndex, event);
    const at = { x: event.x, y: event.y + 1 };
    if (spot && event.button === RIGHT_BUTTON)
      return app.actions.symbolMenu(spot, at);
    if (
      spot &&
      (event.modifiers.alt || event.modifiers.ctrl || app.commandHeld())
    )
      return void app.actions.goToDefinition(spot, at);
    if (takesFocus) app.actions.setFocus('main');
    const index = view.stopAtRow(rowIndex);
    const stop = stops[index];
    if (!stop) return;
    const x = event.x - left;
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
