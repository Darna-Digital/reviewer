import { TABS } from '../app/useSidebar';
import type { Tab } from '../app/useSidebar';
import type { Palette } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { List } from './List';

const TAB_LABEL: Record<Tab, string> = {
  files: 'Files',
  branches: 'Branches',
  history: 'History',
  comments: 'Comments',
};

/** Fallback names for a sidebar too narrow for the full ones. */
const TAB_SHORT: Record<Tab, string> = {
  files: 'Files',
  branches: 'Refs',
  history: 'Log',
  comments: 'Notes',
};

const EMPTY_TEXT: Record<Tab, string> = {
  files: 'No changed files',
  branches: 'No branches',
  history: 'No commits yet',
  comments: 'No comments yet — press c on a line',
};

export function Sidebar() {
  const app = useAppContext();
  const { palette, sidebar, list, review, actions, bodyHeight, overlay } = app;
  const focused = app.focus === 'sidebar' && !overlay;
  const counts: Partial<Record<Tab, number>> = {
    files: review.files.length,
    comments: review.comments.length,
  };

  return (
    <box
      flexDirection="column"
      width={sidebar.width}
      height={bodyHeight}
      backgroundColor={palette.frame}
    >
      <TabBar
        palette={palette}
        active={sidebar.tab}
        focused={focused}
        counts={counts}
        width={sidebar.width}
        onPick={(tab) => actions.focusSidebar(tab)}
      />
      <Line
        segs={[{ text: '─'.repeat(sidebar.width), fg: palette.rule }]}
        width={sidebar.width}
        fill={palette.frame}
      />
      <List
        key={sidebar.tab}
        items={list.items}
        selected={list.selected}
        focused={focused}
        width={sidebar.width}
        height={bodyHeight - 2}
        palette={palette}
        emptyText={review.loading ? 'Loading…' : EMPTY_TEXT[sidebar.tab]}
        onSelect={(index) => {
          app.setFocus('sidebar');
          actions.selectItem(index);
        }}
        onActivate={(index) => actions.activate(actions.selectItem(index))}
        onScroll={(delta) => actions.stepSelection(delta)}
      />
    </box>
  );
}

interface TabBarProps {
  palette: Palette;
  active: Tab;
  focused: boolean;
  counts: Partial<Record<Tab, number>>;
  width: number;
  onPick: (tab: Tab) => void;
}

/** The widest of full names, short names, or numbers-only that fits. */
function TabBar(props: TabBarProps) {
  const { palette, active, focused, counts, width } = props;
  const forms = [
    (tab: Tab) => TAB_LABEL[tab],
    (tab: Tab) => TAB_SHORT[tab],
    (tab: Tab) => (tab === active ? TAB_LABEL[tab] : null),
  ];
  const tabs =
    forms
      .map((label) =>
        TABS.map((tab, index) => ({
          tab,
          segs: tabSegs(tab, index, label(tab)),
        })),
      )
      .find(
        (form) =>
          1 + form.reduce((sum, t) => sum + segsWidth(t.segs), 0) <= width,
      ) ?? TABS.map((tab, index) => ({ tab, segs: tabSegs(tab, index, null) }));
  const used = 1 + tabs.reduce((sum, t) => sum + segsWidth(t.segs), 0);

  return (
    <box
      flexDirection="row"
      height={1}
      width={width}
      backgroundColor={palette.frame}
    >
      <Line segs={[{ text: ' ' }]} width={1} fill={palette.frame} />
      {tabs.map(({ tab, segs }) => (
        <Line
          key={tab}
          segs={segs}
          width={segsWidth(segs)}
          onMouseDown={() => props.onPick(tab)}
        />
      ))}
      <Line segs={[]} width={Math.max(0, width - used)} fill={palette.frame} />
    </box>
  );

  function tabSegs(tab: Tab, index: number, label: string | null): Seg[] {
    const on = tab === active;
    const bg = on
      ? focused
        ? palette.selection
        : palette.selectionIdle
      : palette.frame;
    const count = counts[tab] ?? 0;
    const segs: Seg[] = [
      {
        text: ` ${index + 1}${label ? ' ' : ''}`,
        fg: on ? palette.accent : palette.faint,
        bg,
        bold: on,
      },
    ];
    if (label)
      segs.push({
        text: label,
        fg: on ? palette.text : palette.muted,
        bg,
        bold: on,
      });
    if (label && count > 0)
      segs.push({
        text: ` ${count}`,
        fg: on ? palette.accent : palette.faint,
        bg,
      });
    segs.push({ text: ' ', bg });
    return segs;
  }
}
