import type { BoxRenderable } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import * as React from 'react';
import { describeComparison } from '../app/comparison';
import { SIDEBAR_HEADER } from '../app/useApp';
import type { Check } from '../render/listItems';
import type { App } from '../app/useApp';
import { treeItems } from '../render/listItems';
import { pullItems } from '../render/pullOverview';
import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import type { TreeNode } from '../tree/fileTree';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { captureMouse } from './captureMouse';
import { CommitBox } from './CommitBox';
import { Button, Line } from './Line';
import { List } from './List';
import { SurfaceTabs } from './SurfaceTabs';
import { TextField } from './TextField';

/** Surface tabs, branch and compare chips, the project or changes tree, and the commit box. */
export function Sidebar() {
  const app = useAppContext();
  const { palette, layout, workspace, review, actions } = app;
  const width = layout.sidebarWidth;
  const focused = app.focus === 'sidebar' && !app.overlay;
  const isReview = workspace.surface === 'review';

  if (isReview && workspace.sidebarList === 'pulls') {
    return (
      <box
        flexDirection="column"
        width={width}
        height={layout.bodyHeight}
        backgroundColor={palette.frame}
      >
        <SurfaceTabs />
        <Header />
        <PullList />
        {app.showsPullFiles && review.comparison.kind === 'pull' ? (
          <>
            <PullFilesRule />
            <FileTree
              height={layout.pullFilesHeight}
              focused={focused && app.pullPart === 'files'}
              focusTree={() => actions.focusPullPart('files')}
              filterPlaceholder={`Filter files in #${review.comparison.number}`}
            />
          </>
        ) : null}
      </box>
    );
  }

  return (
    <box
      flexDirection="column"
      width={width}
      height={layout.bodyHeight}
      backgroundColor={palette.frame}
    >
      <SurfaceTabs />
      <Header />
      <FileTree
        height={layout.treeHeight}
        focused={focused}
        focusTree={() => actions.setFocus('sidebar')}
        filterPlaceholder={isReview ? 'Filter changed files' : null}
      />
      {app.isCommitMode ? <CommitBox height={layout.commitBoxHeight} /> : null}
    </box>
  );
}

/** The project tree, or on Review the changed files under their filter. */
function FileTree({
  height,
  focused,
  focusTree,
  filterPlaceholder,
}: {
  height: number;
  focused: boolean;
  focusTree: () => void;
  filterPlaceholder: string | null;
}) {
  const app = useAppContext();
  const { palette, layout, tree, commit, review, actions } = app;
  const width = layout.sidebarWidth;
  const checkOf = app.isCommitMode
    ? (node: TreeNode) => checkState(node, commit.isIncluded, commit.paths)
    : null;
  return (
    <>
      {filterPlaceholder !== null ? (
        <TextField
          palette={palette}
          width={width}
          placeholder={filterPlaceholder}
          value={tree.query}
          focused={app.typing === 'treeFilter'}
          onInput={tree.setQuery}
          onFocus={() => {
            focusTree();
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
        height={height}
        palette={palette}
        emptyText={
          review.loading
            ? 'Loading…'
            : filterPlaceholder !== null
              ? tree.query
                ? 'No files match'
                : 'No changes'
              : 'No files'
        }
        onSelect={(item) => {
          if (!item.value) return focusTree();
          tree.select(item.value.path);
          if (item.value.kind !== 'file') return focusTree();
          // a clicked file takes the keyboard, so its tab reads on at once
          actions.openTreeNode(item.value, { preview: true });
          actions.setFocus('main');
        }}
        onActivate={(item) => item.value && actions.openTreeNode(item.value)}
        onContextMenu={(item, at) =>
          item.value && actions.treeMenu(item.value, at)
        }
        onScroll={(delta) => {
          // the tree follows the open file until it has the keyboard
          if (!focused) focusTree();
          actions.stepTree(delta);
        }}
      />
    </>
  );
}

/** The open pull requests, searchable; j/k open each, ⏎ moves to its diff. */
function PullList() {
  const app = useAppContext();
  const { palette, layout, pulls, review, actions, now } = app;
  const width = layout.sidebarWidth;
  const shown =
    review.comparison.kind === 'pull' ? review.comparison.number : null;
  const items = pullItems(palette, pulls.groups, shown, now);
  const selected = items.findIndex(
    (item) => item.value?.number === (pulls.cursor ?? shown),
  );
  const focused = app.focus === 'sidebar' && app.pullPart === 'list';
  return (
    <>
      <TextField
        palette={palette}
        width={width}
        placeholder="Search pull requests"
        value={pulls.query}
        focused={app.typing === 'pullFilter'}
        onInput={pulls.setQuery}
        onFocus={() => {
          actions.focusPullPart('list');
          actions.setTyping('pullFilter');
        }}
        bg={palette.frame}
      />
      <List
        items={items}
        selected={selected}
        focused={focused && !app.overlay}
        width={width}
        height={layout.pullListHeight}
        palette={palette}
        emptyText={pullListEmpty(app)}
        onSelect={(item) => {
          if (!item.value) return actions.focusPullPart('list');
          actions.reviewPull(item.value.number, { stay: true });
          actions.focusPullPart('list');
        }}
        onActivate={(item) =>
          item.value && actions.reviewPull(item.value.number)
        }
        onContextMenu={(item, at) => {
          const pull = item.value;
          if (!pull) return;
          actions.openMenu(at, [
            { label: 'Review', run: () => actions.reviewPull(pull.number) },
            { label: 'Check out', run: () => actions.checkoutPull(pull) },
            { separator: true },
            { label: 'Open on GitHub', run: () => actions.openUrl(pull.url) },
            { label: 'Copy link', run: () => actions.copy(pull.url) },
            {
              label: 'Copy branch name',
              run: () => actions.copy(pull.headRef),
            },
          ]);
        }}
        onScroll={(delta) => {
          if (!focused) actions.focusPullPart('list');
          actions.stepPulls(delta);
        }}
      />
    </>
  );
}

/**
 * The rule between the pull requests and the files of the one under review;
 * dragging it moves the split.
 */
function PullFilesRule() {
  const { palette, layout, workspace, review } = useAppContext();
  const renderer = useRenderer();
  const ref = React.useRef<BoxRenderable | null>(null);
  const [active, setActive] = React.useState(false);
  const rule = active ? palette.accent : palette.rule;
  const glyph = active ? '━' : '─';
  const count = ` ${review.files.length} file${review.files.length === 1 ? '' : 's'} `;
  const label = 'FILES ';
  return (
    <box
      ref={ref}
      height={1}
      width={layout.sidebarWidth}
      onMouseDown={() => captureMouse(renderer, ref.current)}
      onMouseDrag={(event) => workspace.resizePullList(event.y - PULL_LIST_TOP)}
      onMouseOver={() => setActive(true)}
      onMouseOut={() => setActive(false)}
      onMouseDragEnd={() => setActive(false)}
    >
      <Line
        segs={[
          { text: `${glyph} `, fg: rule },
          {
            text: label,
            fg: active ? palette.accent : palette.faint,
            bold: true,
          },
          {
            text: glyph.repeat(
              Math.max(
                0,
                layout.sidebarWidth - 2 - label.length - count.length,
              ),
            ),
            fg: rule,
          },
          { text: count, fg: palette.faint },
        ]}
        width={layout.sidebarWidth}
        fill={palette.frame}
      />
    </box>
  );
}

/** The pull request list's first row: under the tabs, chips and search field. */
const PULL_LIST_TOP = SIDEBAR_HEADER + 1;

/** Why the list is empty, most specific first — as the Mac list says it. */
function pullListEmpty(app: App): string {
  const { pulls } = app;
  if (pulls.error) return pulls.error;
  if (!pulls.loaded) return 'Loading…';
  if (pulls.list.length === 0) return 'No open pull requests';
  return 'No pull requests match';
}

function Header() {
  const { palette, layout, workspace, review, pulls, actions } =
    useAppContext();
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
      text: truncate(
        pulls.shown
          ? `#${pulls.shown.number} ${pulls.shown.title}`
          : describeComparison(review.comparison),
        half - 6,
      ),
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
