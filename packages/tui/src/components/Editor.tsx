import { COMMENTS_POPOVER_WIDTH, commentsToList } from './CommentsPopover';
import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { DiffPane } from './DiffPane';
import { Button, Line } from './Line';
import { useDoubleClick } from './useDoubleClick';

/** The editor island: its header row, then the diff (Review) or the open file (Browse). */
export function Editor() {
  const app = useAppContext();
  const { palette, layout, workspace } = app;
  const isReview = workspace.surface === 'review';
  return (
    <box
      flexDirection="column"
      width={layout.mainWidth}
      height={layout.editorHeight}
      backgroundColor={palette.island}
    >
      {isReview ? <ReviewHeader /> : <TabStrip />}
      <Content />
    </box>
  );
}

function Content() {
  const app = useAppContext();
  const { layout, workspace, review, editor, diff } = app;
  const width = layout.mainWidth;
  const height = layout.contentHeight;

  if (workspace.surface === 'review') {
    if (review.files.length === 0) {
      const clean = review.comparison.kind === 'worktree';
      return (
        <Empty
          lines={
            review.loading
              ? [[{ text: 'Reading the diff…' }]]
              : [
                  [{ text: '✓', fg: app.palette.added, bold: true }],
                  [],
                  [
                    {
                      text: clean ? 'Working tree is clean' : 'Nothing differs',
                      bold: true,
                    },
                  ],
                  [
                    {
                      text: clean
                        ? 'No uncommitted changes to review.'
                        : 'This comparison has no changes.',
                      fg: app.palette.muted,
                    },
                  ],
                  [],
                  [
                    { text: 't', fg: app.palette.accent, bold: true },
                    {
                      text: ' compare against a branch    ',
                      fg: app.palette.faint,
                    },
                    { text: '5', fg: app.palette.accent, bold: true },
                    { text: ' history', fg: app.palette.faint },
                  ],
                ]
          }
        />
      );
    }
    return <DiffPane view={diff} width={width} height={height} sticky />;
  }

  if (!editor.active) {
    return (
      <Empty
        lines={[
          [{ text: 'No file open', bold: true }],
          [
            {
              text: 'Pick one in the tree, or search for it.',
              fg: app.palette.muted,
            },
          ],
          [],
          [
            { text: 'p', fg: app.palette.accent, bold: true },
            { text: ' go to file    ', fg: app.palette.faint },
            { text: '/', fg: app.palette.accent, bold: true },
            { text: ' search in files', fg: app.palette.faint },
          ],
        ]}
      />
    );
  }
  if (editor.loading)
    return <Empty lines={[[{ text: 'Opening…', fg: app.palette.muted }]]} />;
  return (
    <DiffPane
      view={editor.viewer}
      width={width}
      height={height}
      sticky={false}
    />
  );
}

function Empty({ lines }: { lines: Seg[][] }) {
  const { palette, layout } = useAppContext();
  const height = layout.contentHeight;
  const padTop = Math.max(0, Math.floor((height - lines.length) / 2) - 1);
  return (
    <box
      flexDirection="column"
      width={layout.mainWidth}
      height={height}
      backgroundColor={palette.island}
    >
      {Array.from({ length: height }, (_, i) => {
        const line = (lines[i - padTop] ?? []).map((seg) => ({
          ...seg,
          fg: seg.fg ?? palette.text,
        }));
        const pad = Math.max(
          0,
          Math.floor((layout.mainWidth - segsWidth(line)) / 2),
        );
        return (
          <Line
            key={i}
            segs={[{ text: ' '.repeat(pad) }, ...line]}
            width={layout.mainWidth}
            fill={palette.island}
          />
        );
      })}
    </box>
  );
}

/** What the diff holds and how it is drawn; the comparison is picked in the sidebar. */
function ReviewHeader() {
  const { palette, layout, review, diff, workspace } = useAppContext();
  const bg = palette.frame;
  const additions = review.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = review.files.reduce((sum, file) => sum + file.deletions, 0);
  const summary: Seg[] = [
    {
      text: ` ${review.files.length} ${review.files.length === 1 ? 'file' : 'files'}  `,
      fg: palette.faint,
      bg,
    },
    {
      text: `+${additions}`,
      fg: additions ? palette.added : palette.faint,
      bg,
    },
    { text: ' ', bg },
    {
      text: `−${deletions}`,
      fg: deletions ? palette.deleted : palette.faint,
      bg,
    },
    ...(review.loading ? [{ text: '  ◌', fg: palette.faint, bg }] : []),
  ];
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.mainWidth}
      backgroundColor={bg}
    >
      <Line segs={summary} width={segsWidth(summary)} fill={bg} />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <Toggle
        label="hunks"
        on={!workspace.fullFiles}
        onPress={() => workspace.fullFiles && workspace.toggleFullFiles()}
      />
      <Toggle
        label="full files"
        on={workspace.fullFiles}
        onPress={() => !workspace.fullFiles && workspace.toggleFullFiles()}
      />
      <Line segs={[{ text: ' │', fg: palette.rule }]} width={2} fill={bg} />
      <Toggle
        label="unified"
        on={diff.view === 'unified'}
        onPress={() => diff.setView('unified')}
      />
      <Toggle
        label="split"
        on={diff.view === 'split'}
        onPress={() => diff.setView('split')}
      />
      <Line segs={[{ text: ' │', fg: palette.rule }]} width={2} fill={bg} />
      <Toggle
        label="wrap"
        on={diff.wrap}
        onPress={() => diff.setWrap((w) => !w)}
      />
      <CommentsButton />
    </box>
  );
}

/**
 * Open-file tabs; double-click keeps a preview (italic) tab open, as on the
 * Mac, and ⇧-click closes one.
 */
function TabStrip() {
  const { palette, icons, layout, editor, workspace } = useAppContext();
  const isDoubleClick = useDoubleClick();
  const bg = palette.frame;
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.mainWidth}
      backgroundColor={bg}
    >
      {editor.tabs.length === 0 ? (
        <Line
          segs={[{ text: '  No open files', fg: palette.faint, italic: true }]}
          width={18}
          fill={bg}
        />
      ) : null}
      {editor.tabs.map((tab) => {
        const on = tab.path === editor.active;
        const tabBg = on ? palette.island : bg;
        const name = truncate(tab.path.split('/').at(-1) ?? tab.path, 28);
        return (
          <box key={tab.path} flexDirection="row" height={1}>
            <Button
              segs={[
                { text: on ? '▎' : ' ', fg: palette.accent, bg: tabBg },
                { text: ' ', bg: tabBg },
                ...icons.file(tab.path, tabBg),
                {
                  text: name,
                  fg: on ? palette.text : palette.muted,
                  bg: tabBg,
                  italic: tab.preview,
                  bold: on,
                },
              ]}
              bg={tabBg}
              hoverTint={palette.text}
              onPress={(event) => {
                if (event.modifiers.shift) editor.close(tab.path);
                else if (isDoubleClick(tab.path)) editor.open(tab.path);
                else editor.activate(tab.path);
              }}
            />
            <Button
              segs={[{ text: ' ✕ ', fg: palette.faint, bg: tabBg }]}
              bg={tabBg}
              hoverTint={palette.deleted}
              onPress={() => editor.close(tab.path)}
            />
          </box>
        );
      })}
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {editor.active ? (
        <Line
          segs={[
            { text: `${truncate(editor.active, 50)}  `, fg: palette.faint },
          ]}
          width={Math.min(52, editor.active.length + 2)}
          fill={bg}
        />
      ) : null}
      <Toggle
        label="wrap"
        on={workspace.wrap}
        onPress={() => workspace.setWrap((on) => !on)}
      />
      <CommentsButton />
    </box>
  );
}

/** Opens the comments popover under itself, at the header's right end. */
function CommentsButton() {
  const app = useAppContext();
  const { layout, activeView, actions } = app;
  return (
    <Toggle
      label={`◆ ${commentsToList(app).length} comments ▾`}
      on={activeView.showComments}
      onPress={() =>
        actions.openOverlay({
          kind: 'commentsHere',
          at: {
            x: layout.mainLeft + layout.mainWidth - COMMENTS_POPOVER_WIDTH,
            y: layout.contentTop,
          },
        })
      }
    />
  );
}

function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppContext();
  const bg = on ? mix(palette.frame, palette.text, 0.1) : palette.frame;
  return (
    <Button
      segs={[
        {
          text: ` ${label} `,
          fg: on ? palette.text : palette.faint,
          bg,
          bold: on,
        },
      ]}
      bg={bg}
      hoverTint={palette.text}
      onPress={onPress}
    />
  );
}
