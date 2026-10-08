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
    isOn: (app) => app.workspace.surface === 'review' && !isSearching(app),
    run: (app) => app.actions.setSurface('review'),
  },
];

const SEARCH: Tab = {
  label: ' ⌕ ',
  isOn: isSearching,
  run: (app) => app.actions.openPalette('text'),
};

/** Browse and Review, and Search at the far end — the head of the sidebar. */
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
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <TabButton tab={SEARCH} />
      <Line segs={[]} width={1} fill={bg} />
    </box>
  );
}

function TabButton({ tab }: { tab: Tab }) {
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
      ]}
      bg={tabBg}
      hoverTint={palette.text}
      onPress={() => tab.run(app)}
    />
  );
}

function isSearching(app: App): boolean {
  return app.overlay?.kind === 'palette' && app.overlay.mode === 'text';
}
