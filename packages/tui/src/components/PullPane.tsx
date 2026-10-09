import { mix } from '../render/palette';
import { pullOverviewLines } from '../render/pullOverview';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { useWheel } from './useWheel';

const KEYS: Array<[key: string, does: string]> = [
  ['c', 'check out'],
  ['m', 'merge'],
  ['x', 'close'],
  ['o', 'open on GitHub'],
  ['y', 'copy link'],
  ['r', 'reload'],
];

/** The pull request under review: its overview, checks and description. */
export function PullPane({
  height,
  focused,
}: {
  height: number;
  focused: boolean;
}) {
  const app = useAppContext();
  const { palette, layout, pulls, review, now, actions } = app;
  const width = layout.mainWidth;
  const bg = palette.frame;
  const wheel = useWheel((rows) => pulls.scrollPane(rows));
  const pull = pulls.shown;
  const keyBar: Seg[] = KEYS.flatMap(([key, does]) => [
    {
      text: ` ${key}`,
      fg: focused ? palette.accent : palette.muted,
      bold: true,
    },
    { text: ` ${does} `, fg: palette.faint },
  ]);

  const message =
    review.comparison.kind !== 'pull'
      ? 'No pull request under review — press M to pick one'
      : (pulls.error ??
        (pulls.loading
          ? 'Loading…'
          : `#${review.comparison.number} is no longer open`));
  if (!pull) {
    return (
      <box width={width} height={height} backgroundColor={bg}>
        <Line
          segs={[{ text: `  ${message}`, fg: palette.faint }]}
          width={width}
          fill={bg}
        />
      </box>
    );
  }

  const bodyRows = height - 1;
  const lines = pullOverviewLines(palette, pull, width - 4, now);
  pulls.paneLimit.current = Math.max(0, lines.length - bodyRows);
  const top = pulls.paneTop;
  const busy = pulls.busy === pull.number;

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
      onMouseScroll={wheel}
      onMouseDown={() => actions.setFocus('bottom')}
    >
      <Line
        segs={[
          ...keyBar,
          ...(busy ? [{ text: '  working…', fg: palette.warning }] : []),
        ]}
        width={width}
        fill={mix(bg, palette.text, 0.03)}
      />
      {Array.from({ length: bodyRows }, (_, row) => (
        <Line
          key={row}
          segs={[{ text: '  ' }, ...(lines[top + row] ?? [])]}
          width={width}
          fill={bg}
        />
      ))}
    </box>
  );
}
