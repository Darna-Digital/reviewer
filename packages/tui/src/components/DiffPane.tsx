import type { MouseEvent } from '@opentui/core';
import type { App } from '../app/useApp';
import type { Row } from '../diff/buildLayout';
import { paintFileHeader, paintRow } from '../render/diffRows';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { useDoubleClick } from './useDoubleClick';

const WHEEL_STEP = 3;
/** Clicks this close to a file header's left edge hit its fold chevron. */
const CHEVRON_CELLS = 4;

/**
 * The virtualized diff: only rows in view are drawn, the current file's
 * header stays pinned once its own has scrolled away.
 */
export function DiffPane() {
  const app = useAppContext();
  const { palette, diff, review, banner, diffWidth, bodyHeight } = app;
  const { rows, stops } = diff.layout;
  const isDoubleClick = useDoubleClick();
  const visible = rows.slice(diff.top, diff.top + diff.height);
  const cursorRows = diff.stop
    ? [diff.stop.row, diff.stop.row + diff.stop.height]
    : [-1, -1];
  const sticky = stickyFile(rows[diff.top]);

  return (
    <box
      flexDirection="column"
      width={diffWidth}
      height={bodyHeight}
      backgroundColor={palette.island}
      onMouseScroll={(event) => {
        if (event.scroll?.direction === 'up') diff.scrollBy(-WHEEL_STEP);
        if (event.scroll?.direction === 'down') diff.scrollBy(WHEEL_STEP);
      }}
    >
      {banner.map((segs, i) => (
        <Line
          key={`banner-${i}`}
          segs={segs}
          width={diffWidth}
          fill={palette.control}
        />
      ))}
      {review.files.length === 0 ? (
        <EmptyState app={app} />
      ) : (
        visible.map((row, i) => {
          const index = diff.top + i;
          if (i === 0 && sticky !== null) {
            return (
              <Line
                key="sticky"
                segs={paintFileHeader(diff.paint, sticky, false)}
                width={diffWidth}
                onMouseDown={() => diff.jumpToFile(sticky)}
              />
            );
          }
          const isCursor = index >= cursorRows[0]! && index < cursorRows[1]!;
          return (
            <Line
              key={index}
              segs={paintRow(diff.paint, row, isCursor)}
              width={diffWidth}
              fill={palette.island}
              onMouseDown={(event) => clickRow(index, event)}
            />
          );
        })
      )}
      <box flexGrow={1} backgroundColor={palette.island} />
    </box>
  );

  function clickRow(rowIndex: number, event: MouseEvent) {
    app.setFocus('diff');
    const index = diff.stopAtRow(rowIndex);
    const stop = stops[index];
    if (!stop) return;
    const x = event.x - (app.sidebar.width + (app.sidebar.visible ? 1 : 0));
    if (diff.view === 'split')
      diff.setSide(x > diff.layout.geometry.half ? 'right' : 'left');
    diff.moveTo(index);

    const file = review.files[stop.file];
    const isDouble = isDoubleClick(stop.key);
    if (
      stop.target.kind === 'file' &&
      file &&
      (isDouble || x < CHEVRON_CELLS)
    ) {
      diff.toggleFold(file);
    } else if (stop.target.kind === 'comment' && isDouble) {
      app.actions.editComment(stop.target.comment);
    } else if (stop.target.kind === 'line' && isDouble) {
      app.actions.compose();
    }
  }
}

/** The file whose header to pin, when the top row is inside its body. */
function stickyFile(row: Row | undefined): number | null {
  if (!row || row.kind === 'file' || row.kind === 'spacer') return null;
  return row.file;
}

function EmptyState({ app }: { app: App }) {
  const { palette, review, diffWidth, diff } = app;
  const isWorktree = review.comparison.kind === 'worktree';
  const lines: Seg[][] = review.loading
    ? [[{ text: 'Reading the diff…', fg: palette.muted }]]
    : [
        [{ text: '✓', fg: palette.added, bold: true }],
        [],
        [
          {
            text: isWorktree ? 'Working tree is clean' : 'Nothing differs',
            fg: palette.text,
            bold: true,
          },
        ],
        [
          {
            text: isWorktree
              ? 'No uncommitted changes to review.'
              : 'This comparison has no changes.',
            fg: palette.muted,
          },
        ],
        [],
        [
          { text: 't', fg: palette.accent, bold: true },
          { text: ' compare against a branch   ', fg: palette.faint },
          { text: '3', fg: palette.accent, bold: true },
          { text: ' browse history', fg: palette.faint },
        ],
      ];
  const padTop = Math.max(0, Math.floor((diff.height - lines.length) / 2) - 1);
  return (
    <box
      flexDirection="column"
      width={diffWidth}
      height={diff.height}
      backgroundColor={palette.island}
    >
      {Array.from({ length: diff.height }, (_, i) => {
        const line = lines[i - padTop] ?? [];
        const pad = Math.max(0, Math.floor((diffWidth - segsWidth(line)) / 2));
        return (
          <Line
            key={i}
            segs={[{ text: ' '.repeat(pad) }, ...line]}
            width={diffWidth}
            fill={palette.island}
          />
        );
      })}
    </box>
  );
}
