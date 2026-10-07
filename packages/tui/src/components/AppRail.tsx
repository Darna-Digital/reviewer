import * as React from 'react';
import type { App } from '../app/useApp';
import { RAIL_WIDTH } from '../app/useWorkspace';
import type { BottomTab, Surface } from '../app/useWorkspace';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { Line } from './Line';

interface RailItem {
  glyph: string;
  label: string;
  key: string;
  isOn: (app: App) => boolean;
  run: (app: App) => void;
}

const surfaceItem = (
  surface: Surface,
  glyph: string,
  label: string,
  key: string,
): RailItem => ({
  glyph,
  label,
  key,
  isOn: (app) => app.workspace.surface === surface,
  run: (app) => app.actions.setSurface(surface),
});

const paneItem = (
  tab: BottomTab,
  glyph: string,
  label: string,
  key: string,
): RailItem => ({
  glyph,
  label,
  key,
  isOn: (app) => app.workspace.bottomOpen && app.workspace.bottomTab === tab,
  run: (app) => app.actions.toggleBottomTab(tab),
});

const TOP: RailItem[] = [
  surfaceItem('browse', '≡', 'Browse the project', '1'),
  surfaceItem('review', '±', 'Review', '2'),
  {
    glyph: '⌕',
    label: 'Search in files',
    key: '/',
    isOn: (app) => app.overlay?.kind === 'search',
    run: (app) => app.actions.openOverlay({ kind: 'search' }),
  },
];

const BOTTOM: RailItem[] = [
  paneItem('branches', '⎇', 'Branches', '4'),
  paneItem('history', '◷', 'History', '5'),
  paneItem('terminal', '❯', 'Terminal', '6'),
  paneItem('run', '▶', 'Run', '7'),
];

/** The vertical rail: surfaces at the top, the bottom pane's tabs at the foot. */
export function AppRail() {
  const app = useAppContext();
  const { palette, layout } = app;
  const [hovered, setHovered] = React.useState<{
    item: RailItem;
    row: number;
  } | null>(null);
  const gap = Math.max(
    0,
    layout.bodyHeight - (TOP.length + BOTTOM.length) * 2 - 1,
  );

  return (
    <box
      flexDirection="column"
      width={RAIL_WIDTH}
      height={layout.bodyHeight}
      backgroundColor={palette.frame}
    >
      <Line segs={[]} width={RAIL_WIDTH} fill={palette.frame} />
      {TOP.map((item, i) => renderItem(item, 1 + i * 2))}
      <box height={gap} backgroundColor={palette.frame} />
      {BOTTOM.map((item, i) =>
        renderItem(item, 1 + TOP.length * 2 + gap + i * 2),
      )}
      {hovered ? <Tooltip item={hovered.item} row={hovered.row} /> : null}
    </box>
  );

  function renderItem(item: RailItem, row: number) {
    const on = item.isOn(app);
    const bg = on
      ? palette.selection
      : hovered?.item === item
        ? mix(palette.frame, palette.text, 0.1)
        : palette.frame;
    return (
      <box key={item.label} flexDirection="column" height={2}>
        <Line
          segs={[
            {
              text: ` ${item.glyph} `,
              fg: on ? palette.accent : palette.muted,
              bg,
              bold: on,
            },
          ]}
          width={RAIL_WIDTH}
          onMouseDown={() => item.run(app)}
          onMouseOver={() => setHovered({ item, row })}
          onMouseOut={() => setHovered(null)}
        />
        <Line segs={[]} width={RAIL_WIDTH} fill={palette.frame} />
      </box>
    );
  }
}

function Tooltip({ item, row }: { item: RailItem; row: number }) {
  const { palette } = useAppContext();
  const text = ` ${item.label}  ${item.key} `;
  return (
    <box
      position="absolute"
      left={RAIL_WIDTH}
      top={row}
      zIndex={50}
      height={1}
      width={text.length}
    >
      <Line
        segs={[
          { text: ` ${item.label}  `, fg: palette.text, bg: palette.popover },
          { text: `${item.key} `, fg: palette.faint, bg: palette.popover },
        ]}
        width={text.length}
      />
    </box>
  );
}
