import { usageItems } from '../render/listItems';
import { mix } from '../render/palette';
import type { Seg } from '../render/styled';
import { truncateStart } from '../text/measure';
import { useAppContext } from './AppContext';
import { DiffPane } from './DiffPane';
import { DragRule } from './DragRule';
import { Button, Line } from './Line';
import { List } from './List';

/**
 * Find usages, as the Mac app lays it out: the symbol and its count above a
 * tree of category › file › usage, and the selected usage's file beside it,
 * scrolled to the line. ⏎ or a double-click opens the usage.
 */
export function UsagesPane({
  height,
  focused,
}: {
  height: number;
  focused: boolean;
}) {
  const app = useAppContext();
  const { palette, layout, symbols, actions, workspace, usagePreview } = app;
  const width = layout.mainWidth;
  const listWidth = layout.usagesListWidth;
  const previewWidth = width - listWidth - 1;
  const bg = palette.frame;
  const { usages } = symbols;

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <Header />
      {usages?.status !== 'done' || usages.rows.length === 0 ? (
        <Empty height={height - 1} />
      ) : (
        <box flexDirection="row" height={height - 1} width={width}>
          <List
            items={usageItems(palette, app.icons, usages.rows, usages.symbol)}
            selected={symbols.usageIndexes[symbols.selected] ?? -1}
            focused={focused}
            width={listWidth}
            height={height - 1}
            palette={palette}
            emptyText=""
            onSelect={(item) => {
              actions.setFocus('bottom');
              if (item.value !== undefined) symbols.selectRow(item.value);
            }}
            onActivate={() =>
              symbols.selectedUsage && actions.openUsage(symbols.selectedUsage)
            }
            onScroll={symbols.stepUsage}
          />
          <DragRule
            direction="vertical"
            length={height - 1}
            onDrag={(event) =>
              workspace.resizeUsagesList(event.x - layout.mainLeft)
            }
          />
          <box flexDirection="column" width={previewWidth} height={height - 1}>
            <PreviewHeader width={previewWidth} />
            {symbols.preview ? (
              <DiffPane
                view={usagePreview}
                width={previewWidth}
                height={height - 2}
                sticky={false}
                left={layout.mainLeft + listWidth + 1}
                takesFocus={false}
              />
            ) : null}
          </box>
        </box>
      )}
    </box>
  );
}

function Header() {
  const { palette, layout, symbols } = useAppContext();
  const bg = palette.frame;
  const { usages } = symbols;
  const count =
    usages?.status === 'done' ? usages.result.references.length : null;
  const title: Seg[] = usages
    ? [
        { text: ' ⌕ ', fg: palette.accent },
        { text: usages.symbol, fg: palette.text, bold: true },
        ...(count === null
          ? []
          : [
              {
                text: ` — ${count} ${count === 1 ? 'usage' : 'usages'}`,
                fg: palette.faint,
              },
            ]),
      ]
    : [{ text: ' ⌕ Find usages', fg: palette.muted }];
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.mainWidth}
      backgroundColor={bg}
    >
      <Line
        segs={title}
        width={Math.min(layout.mainWidth - 30, 80)}
        fill={bg}
      />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {usages ? (
        <>
          <Tool label=" ↑ " onPress={() => symbols.stepUsage(-1)} />
          <Tool label=" ↓ " onPress={() => symbols.stepUsage(1)} />
          <Tool label=" ↻ again " onPress={() => void symbols.rerun()} />
        </>
      ) : null}
    </box>
  );
}

function Tool({ label, onPress }: { label: string; onPress: () => void }) {
  const { palette } = useAppContext();
  const bg = mix(palette.frame, palette.text, 0.06);
  return (
    <box flexDirection="row" height={1}>
      <Button
        segs={[{ text: label, fg: palette.muted, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={onPress}
      />
      <Line segs={[{ text: ' ' }]} width={1} fill={palette.frame} />
    </box>
  );
}

function PreviewHeader({ width }: { width: number }) {
  const { palette, icons, symbols, actions } = useAppContext();
  const usage = symbols.selectedUsage;
  const bg = mix(palette.frame, palette.text, 0.03);
  if (!usage) return <Line segs={[]} width={width} fill={bg} />;
  const { path, range } = usage.location;
  const slash = path.lastIndexOf('/') + 1;
  return (
    <Button
      segs={[
        { text: ' ', bg },
        ...icons.file(path, bg),
        {
          text: truncateStart(path.slice(0, slash), Math.max(0, width - 30)),
          fg: palette.faint,
          bg,
        },
        {
          text: `${path.slice(slash)}:${range.start.line + 1}`,
          fg: palette.text,
          bg,
          bold: true,
        },
        { text: '   ⏎ open', fg: palette.faint, bg },
        { text: ' '.repeat(Math.max(0, width)), bg },
      ]}
      bg={bg}
      hoverTint={palette.text}
      onPress={() => actions.openUsage(usage)}
    />
  );
}

function Empty({ height }: { height: number }) {
  const { palette, layout, symbols } = useAppContext();
  const { usages } = symbols;
  const [title, detail] = !usages
    ? [
        'No search yet',
        'Right-click a symbol and choose Find usages, or press . on a line.',
      ]
    : usages.status === 'loading'
      ? [
          `Searching for ${usages.symbol}…`,
          'The first search can wait for the language server to start.',
        ]
      : usages.status === 'failed'
        ? ['Could not find usages', usages.message]
        : [
            `No usages of ${usages.symbol}`,
            'Nothing in the project refers to this symbol.',
          ];
  return (
    <box
      flexDirection="column"
      width={layout.mainWidth}
      height={height}
      backgroundColor={palette.frame}
    >
      <Line segs={[]} width={layout.mainWidth} fill={palette.frame} />
      <Line
        segs={[{ text: `   ${title}`, fg: palette.text, bold: true }]}
        width={layout.mainWidth}
        fill={palette.frame}
      />
      <Line
        segs={[{ text: `   ${detail}`, fg: palette.faint }]}
        width={layout.mainWidth}
        fill={palette.frame}
      />
    </box>
  );
}
