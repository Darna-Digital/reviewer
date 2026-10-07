import { describeComparison } from '../app/comparison';
import { COMMIT_BOX_HEIGHT } from '../app/useApp';
import type { Check } from '../render/listItems';
import { treeItems } from '../render/listItems';
import { mix } from '../render/palette';
import type { TreeNode } from '../tree/fileTree';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { CommitBox } from './CommitBox';
import { Button, Line } from './Line';
import { List } from './List';
import { TextField } from './TextField';

/** Branch and compare chips, the project or changes tree, and the commit box. */
export function Sidebar() {
  const app = useAppContext();
  const { palette, layout, workspace, tree, commit, review, actions } = app;
  const width = layout.sidebarWidth;
  const focused = app.focus === 'sidebar' && !app.overlay;
  const isReview = workspace.surface === 'review';
  const checkOf = app.isCommitMode
    ? (node: TreeNode) => checkState(node, commit.isIncluded, commit.paths)
    : null;

  return (
    <box
      flexDirection="column"
      width={width}
      height={layout.bodyHeight}
      backgroundColor={palette.frame}
    >
      <Header />
      {isReview ? (
        <TextField
          palette={palette}
          width={width}
          placeholder="Filter changed files"
          value={tree.query}
          focused={app.typing === 'treeFilter'}
          onInput={tree.setQuery}
          onFocus={() => {
            actions.setFocus('sidebar');
            actions.setTyping('treeFilter');
          }}
          bg={palette.frame}
        />
      ) : null}
      <List
        items={treeItems(palette, tree.rows, checkOf)}
        selected={tree.selected}
        focused={focused}
        width={width}
        height={layout.treeHeight}
        palette={palette}
        emptyText={
          review.loading
            ? 'Loading…'
            : isReview
              ? tree.query
                ? 'No files match'
                : 'No changes'
              : 'No files'
        }
        onSelect={(item) => {
          actions.setFocus('sidebar');
          if (!item.value) return;
          tree.select(item.value.path);
          if (item.value.kind === 'file')
            actions.openTreeNode(item.value, { preview: true });
        }}
        onActivate={(item) => item.value && actions.openTreeNode(item.value)}
        onContextMenu={(item, at) =>
          item.value && actions.treeMenu(item.value, at)
        }
        onScroll={(delta) => tree.step(delta)}
      />
      {app.isCommitMode ? <CommitBox height={COMMIT_BOX_HEIGHT} /> : null}
    </box>
  );
}

function Header() {
  const { palette, layout, workspace, review, actions } = useAppContext();
  const bg = palette.frame;
  const chip = mix(bg, palette.text, 0.07);
  const half = Math.floor((layout.sidebarWidth - 2) / 2);
  const branch = review.repo?.branch ?? 'No branch';
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.sidebarWidth}
      backgroundColor={bg}
    >
      <Button
        segs={[
          { text: ' ⎇ ', fg: palette.faint, bg: chip },
          {
            text: truncate(branch, half - 6),
            fg: palette.text,
            bg: chip,
            bold: true,
          },
          { text: ' ▾ ', fg: palette.faint, bg: chip },
        ]}
        bg={chip}
        hoverTint={palette.text}
        onPress={() => actions.toggleBottomTab('branches')}
      />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {workspace.surface === 'review' ? (
        <Button
          segs={[
            { text: ' ⇄ ', fg: palette.accent, bg: chip },
            {
              text: truncate(describeComparison(review.comparison), half - 6),
              fg: palette.text,
              bg: chip,
            },
            { text: ' ▾ ', fg: palette.faint, bg: chip },
          ]}
          bg={chip}
          hoverTint={palette.accent}
          onPress={() => actions.openOverlay({ kind: 'targets' })}
        />
      ) : null}
      <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
    </box>
  );
}

function checkState(
  node: TreeNode,
  isIncluded: (path: string) => boolean,
  paths: string[],
): Check {
  const files = node.files.filter((path) => paths.includes(path));
  const included = files.filter(isIncluded).length;
  if (included === 0) return 'none';
  return included === files.length ? 'all' : 'some';
}
