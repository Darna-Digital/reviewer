import { describeComparison } from '../app/comparison';
import { SIDEBAR_HEADER } from '../app/useApp';
import type { Check } from '../render/listItems';
import { treeItems } from '../render/listItems';
import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import type { TreeNode } from '../tree/fileTree';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { CommitBox } from './CommitBox';
import { Button, Line } from './Line';
import { List } from './List';
import { SurfaceTabs } from './SurfaceTabs';
import { TextField } from './TextField';

/** Surface tabs, branch and compare chips, the project or changes tree, and the commit box. */
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
      <SurfaceTabs />
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
        items={treeItems(palette, app.icons, tree.rows, checkOf)}
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
          if (!item.value) return actions.setFocus('sidebar');
          tree.select(item.value.path);
          if (item.value.kind !== 'file') return actions.setFocus('sidebar');
          // a clicked file takes the keyboard, so its tab reads on at once
          actions.openTreeNode(item.value, { preview: true });
          actions.setFocus('main');
        }}
        onActivate={(item) => item.value && actions.openTreeNode(item.value)}
        onContextMenu={(item, at) =>
          item.value && actions.treeMenu(item.value, at)
        }
        onScroll={(delta) => tree.step(delta)}
      />
      {app.isCommitMode ? <CommitBox height={layout.commitBoxHeight} /> : null}
    </box>
  );
}

function Header() {
  const { palette, layout, workspace, review, actions } = useAppContext();
  const bg = palette.frame;
  const chip = mix(bg, palette.text, 0.07);
  const half = Math.floor((layout.sidebarWidth - 2) / 2);
  const branch = review.repo?.branch ?? 'No branch';
  const ahead = review.status?.ahead ?? 0;
  const behind = review.status?.behind ?? 0;
  const drift: Seg[] = [
    ...(behind ? [{ text: ` ↓${behind}`, fg: palette.warning, bg: chip }] : []),
    ...(ahead ? [{ text: ` ↑${ahead}`, fg: palette.added, bg: chip }] : []),
  ];
  const branchSegs: Seg[] = [
    { text: ' ⎇ ', fg: palette.faint, bg: chip },
    {
      text: truncate(branch, half - 6 - segsWidth(drift)),
      fg: palette.text,
      bg: chip,
      bold: true,
    },
    ...drift,
    { text: ' ▾ ', fg: palette.faint, bg: chip },
  ];
  const targetSegs: Seg[] = [
    { text: ' ⇄ ', fg: palette.accent, bg: chip },
    {
      text: truncate(describeComparison(review.comparison), half - 6),
      fg: palette.text,
      bg: chip,
    },
    { text: ' ▾ ', fg: palette.faint, bg: chip },
  ];
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.sidebarWidth}
      backgroundColor={bg}
    >
      <Button
        segs={branchSegs}
        bg={chip}
        hoverTint={palette.text}
        onPress={() => actions.openBranches({ x: 0, y: SIDEBAR_HEADER })}
      />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {workspace.surface === 'review' ? (
        <Button
          segs={targetSegs}
          bg={chip}
          hoverTint={palette.accent}
          onPress={() =>
            actions.openTargets({
              x: layout.sidebarWidth - 1 - segsWidth(targetSegs),
              y: SIDEBAR_HEADER,
            })
          }
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
