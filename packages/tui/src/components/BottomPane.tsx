import type { BoxRenderable } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import * as React from 'react';
import { BOTTOM_TABS } from '../app/useWorkspace';
import type { BottomTab } from '../app/useWorkspace';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { BranchesPane } from './BranchesPane';
import { captureMouse } from './captureMouse';
import { HistoryPane } from './HistoryPane';
import { Button, Line } from './Line';
import { RunPane } from './RunPane';
import { TerminalPane } from './TerminalPane';

const LABEL: Record<BottomTab, string> = {
  branches: 'Branches',
  history: 'History',
  terminal: 'Terminal',
  run: 'Run',
};

/** Branches, History, Terminal and Run; drag the header to resize. */
export function BottomPane() {
  const app = useAppContext();
  const renderer = useRenderer();
  const header = React.useRef<BoxRenderable | null>(null);
  const { palette, layout, workspace, actions, services } = app;
  const bg = mix(palette.frame, palette.text, 0.04);
  const focused = app.focus === 'bottom' && !app.overlay;
  const height = layout.bottomHeight - 1;
  const running = services.running().length;

  return (
    <box
      flexDirection="column"
      width={layout.mainWidth}
      height={layout.bottomHeight}
      backgroundColor={palette.frame}
    >
      <box
        ref={header}
        flexDirection="row"
        height={1}
        width={layout.mainWidth}
        backgroundColor={bg}
        onMouseDown={() => captureMouse(renderer, header.current)}
        onMouseDrag={(event) =>
          workspace.resizeBottom(app.screen.height - 1 - event.y)
        }
      >
        <Line
          segs={[{ text: focused ? '▌' : ' ', fg: palette.accent }]}
          width={1}
          fill={bg}
        />
        {BOTTOM_TABS.map((tab) => {
          const on = workspace.bottomTab === tab;
          const tabBg = on
            ? focused
              ? palette.selection
              : palette.selectionIdle
            : bg;
          const badge = tab === 'run' && running > 0 ? ` ●${running}` : '';
          return (
            <Button
              key={tab}
              segs={[
                {
                  text: ` ${LABEL[tab]}`,
                  fg: on ? palette.text : palette.muted,
                  bg: tabBg,
                  bold: on,
                },
                { text: `${badge} `, fg: palette.process.running, bg: tabBg },
              ]}
              bg={tabBg}
              hoverTint={palette.text}
              onPress={() => {
                workspace.openBottom(tab);
                actions.setFocus('bottom');
              }}
            />
          );
        })}
        <box flexGrow={1} height={1} backgroundColor={bg} />
        {app.captured ? (
          <Line
            segs={[
              {
                text: ' typing into the terminal · ^o to leave ',
                fg: palette.warning,
              },
            ]}
            width={40}
            fill={bg}
          />
        ) : null}
        <Button
          segs={[{ text: ' ⌄ ', fg: palette.faint, bg }]}
          bg={bg}
          hoverTint={palette.text}
          onPress={actions.toggleBottom}
        />
      </box>
      {workspace.bottomTab === 'branches' ? (
        <BranchesPane height={height} focused={focused} />
      ) : null}
      {workspace.bottomTab === 'history' ? (
        <HistoryPane height={height} focused={focused} />
      ) : null}
      {workspace.bottomTab === 'terminal' ? (
        <TerminalPane height={height} />
      ) : null}
      {workspace.bottomTab === 'run' ? (
        <RunPane height={height} focused={focused} />
      ) : null}
    </box>
  );
}
