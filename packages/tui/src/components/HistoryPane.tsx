import { commitFileItems, historyItems } from '../render/listItems';
import { mix } from '../render/palette';
import type { Seg } from '../render/styled';
import { truncate, wrapProse } from '../text/measure';
import { agoLong } from '../text/time';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { List } from './List';
import { TextField } from './TextField';

const DETAILS_SHARE = 0.36;
const MIN_DETAILS = 34;

/** Filter bar over the commit graph, with the selected commit's details beside it. */
export function HistoryPane({
  height,
  focused,
}: {
  height: number;
  focused: boolean;
}) {
  const app = useAppContext();
  const { palette, layout, history, review, actions } = app;
  const width = layout.mainWidth;
  const detailsWidth = history.detail
    ? Math.max(MIN_DETAILS, Math.round(width * DETAILS_SHARE))
    : 0;
  const listWidth = width - detailsWidth - (detailsWidth ? 1 : 0);
  const items = historyItems(
    palette,
    history.commits,
    history.graph,
    review.comparison.kind === 'commit' ? review.comparison.sha : null,
    viewportAround(history.selectedIndex, height),
  );
  const bg = palette.frame;

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
        <TextField
          palette={palette}
          width={Math.min(36, width - 40)}
          placeholder="Text or hash"
          value={history.query}
          focused={app.typing === 'historyFilter'}
          onInput={history.setQuery}
          onFocus={() => {
            actions.setFocus('bottom');
            actions.setTyping('historyFilter');
          }}
        />
        <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
        <Button
          segs={[
            {
              text: history.all
                ? ' ⎇ All branches '
                : ` ⎇ ${review.repo?.branch ?? 'HEAD'} `,
              fg: palette.text,
              bg: palette.control,
            },
            { text: '⇅ ', fg: palette.faint, bg: palette.control },
          ]}
          bg={palette.control}
          hoverTint={palette.text}
          onPress={history.toggleAll}
        />
        {history.path ? (
          <>
            <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
            <Button
              segs={[
                {
                  text: ` ${truncate(history.path.split('/').at(-1) ?? '', 24)} `,
                  fg: palette.accent,
                  bg: palette.control,
                },
                { text: '✕ ', fg: palette.faint, bg: palette.control },
              ]}
              bg={palette.control}
              hoverTint={palette.deleted}
              onPress={() => history.setPath(null)}
            />
          </>
        ) : null}
        <box flexGrow={1} height={1} backgroundColor={bg} />
      </box>
      <box flexDirection="row" height={height - 1} width={width}>
        <List
          items={items}
          selected={items.findIndex((item) => item.key === history.selectedSha)}
          focused={focused}
          width={listWidth}
          height={height - 1}
          palette={palette}
          emptyText={
            history.query || history.path
              ? 'No commits match the current filters'
              : 'No commits yet'
          }
          onSelect={(item) => {
            actions.setFocus('bottom');
            history.select(item.key);
            actions.showCommit(item.key);
          }}
          onActivate={(item) => actions.showCommit(item.key)}
          onContextMenu={(item, at) =>
            actions.openMenu(at, [
              {
                label: 'Show the commit',
                run: () => actions.showCommit(item.key),
              },
              { label: 'Copy hash', run: () => actions.copy(item.key) },
            ])
          }
          onScroll={(delta) => actions.stepHistory(delta)}
        />
        {history.detail ? (
          <>
            <box
              width={1}
              height={height - 1}
              border={['left']}
              borderStyle="single"
              borderColor={palette.rule}
              backgroundColor={bg}
            />
            <Details width={detailsWidth} height={height - 1} />
          </>
        ) : null}
      </box>
    </box>
  );
}

function Details({ width, height }: { width: number; height: number }) {
  const app = useAppContext();
  const { palette, history, actions, now } = app;
  if (!history.detail) return null;
  const { commit, files } = history.detail;
  const bg = mix(palette.frame, palette.text, 0.02);
  const header: Seg[][] = [
    [{ text: ` ${commit.subject}`, fg: palette.text, bold: true }],
    ...wrapProse(commit.body, width - 3)
      .slice(0, 4)
      .map((line): Seg[] => [{ text: ` ${line}`, fg: palette.muted }]),
    [
      { text: ` ${commit.shortSha}`, fg: palette.warning },
      {
        text: ` · ${commit.author} · ${agoLong(commit.date, now)}`,
        fg: palette.faint,
      },
    ],
    [],
    [
      {
        text: ` ${files.length} ${files.length === 1 ? 'FILE' : 'FILES'}`,
        fg: palette.faint,
        bold: true,
      },
    ],
  ];
  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      {header.map((segs, i) => (
        <Line key={i} segs={segs} width={width} fill={bg} />
      ))}
      <List
        items={commitFileItems(palette, files)}
        selected={-1}
        focused={false}
        width={width}
        height={Math.max(1, height - header.length)}
        palette={palette}
        emptyText="No files"
        bg={bg}
        onSelect={(item) =>
          item.value && actions.showCommit(commit.sha, item.value.path)
        }
      />
    </box>
  );
}

/** A screen of commits either side of the selection. */
function viewportAround(selected: number, height: number) {
  const at = Math.max(0, selected);
  return { from: Math.max(0, at - height), to: at + height };
}
