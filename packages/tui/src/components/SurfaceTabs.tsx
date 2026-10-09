import type { App } from '../app/useApp';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

interface Tab {
  label: string;
  isOn: (app: App) => boolean;
  run: (app: App) => void;
}

const SURFACES: Tab[] = [
  {
    label: ' ≡ Browse ',
    isOn: (app) => app.workspace.surface === 'browse' && !isSearching(app),
    run: (app) => app.actions.setSurface('browse'),
  },
  {
    label: ' ± Review ',
    isOn: (app) =>
      app.workspace.surface === 'review' &&
      app.workspace.sidebarList === 'files' &&
      !isSearching(app),
    run: (app) => app.actions.setSurface('review'),
  },
];

/** The open pull requests in the sidebar; the count once they are read. */
const PULLS: Tab = {
  label: ' ⇅ PRs ',
  isOn: (app) =>
    app.workspace.surface === 'review' &&
    app.workspace.sidebarList === 'pulls' &&
    !isSearching(app),
  run: (app) => app.actions.showPullList(),
};

const PULLS_NARROW: Tab = { ...PULLS, label: ' ⇅ ' };
/** Below this the tab drops its word so Search still fits. */
const ROOM_FOR_PULLS_WORD = 38;

const SEARCH: Tab = {
  label: ' ⌕ ',
  isOn: isSearching,
  run: (app) => app.actions.openPalette('text'),
};

/** Browse, Review and pull requests, and Search at the far end — the head of the sidebar. */
export function SurfaceTabs() {
  const app = useAppContext();
  const { palette, layout } = app;
  const bg = palette.frame;
  return (
    <box
      flexDirection="row"
      height={1}
      width={layout.sidebarWidth}
      backgroundColor={bg}
    >
      <Line segs={[]} width={1} fill={bg} />
      {SURFACES.map((tab) => (
        <TabButton key={tab.label} tab={tab} />
      ))}
      <TabButton
        tab={layout.sidebarWidth < ROOM_FOR_PULLS_WORD ? PULLS_NARROW : PULLS}
        badge={pullCount(app)}
      />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <TabButton tab={SEARCH} />
      <Line segs={[]} width={1} fill={bg} />
    </box>
  );
}

function TabButton({ tab, badge }: { tab: Tab; badge?: string }) {
  const app = useAppContext();
  const { palette } = app;
  const on = tab.isOn(app);
  const tabBg = on
    ? palette.selection
    : mix(palette.island, palette.text, 0.06);
  return (
    <Button
      segs={[
        {
          text: tab.label,
          fg: on ? palette.text : palette.muted,
          bg: tabBg,
          bold: on,
        },
        ...(badge
          ? [{ text: `${badge} `, fg: palette.accent, bg: tabBg }]
          : []),
      ]}
      bg={tabBg}
      hoverTint={palette.text}
      onPress={() => tab.run(app)}
    />
  );
}

function pullCount(app: App): string | undefined {
  const count = app.pulls.list.length;
  return app.pulls.error || count === 0 ? undefined : String(count);
}

function isSearching(app: App): boolean {
  return app.overlay?.kind === 'palette' && app.overlay.mode === 'text';
}
