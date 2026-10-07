import type { App } from '../app/useApp';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

interface Tab {
  label: string;
  isOn: (app: App) => boolean;
  run: (app: App) => void;
}

const TABS: Tab[] = [
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
  {
    label: ' ⌕ Search ',
    isOn: isSearching,
    run: (app) => app.actions.openPalette('text'),
  },
];

/** Browse, Review and Search, over the sidebar. */
export function TopRail() {
  const app = useAppContext();
  const { palette, screen } = app;
  const bg = palette.frame;
  const track = mix(palette.island, palette.text, 0.06);

  return (
    <box
      flexDirection="row"
      height={1}
      width={screen.width}
      backgroundColor={bg}
    >
      <Line segs={[]} width={1} fill={bg} />
      {TABS.map((tab) => {
        const on = tab.isOn(app);
        const tabBg = on ? palette.selection : track;
        return (
          <Button
            key={tab.label}
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
      })}
      <box flexGrow={1} height={1} backgroundColor={bg} />
    </box>
  );
}

function isSearching(app: App): boolean {
  return app.overlay?.kind === 'palette' && app.overlay.mode === 'text';
}
