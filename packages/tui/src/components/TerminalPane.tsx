import * as React from 'react';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { TerminalView } from './TerminalView';

/** Shell tabs over a live terminal; a shell opens on first visit. */
export function TerminalPane({ height }: { height: number }) {
  const app = useAppContext();
  const { palette, layout, terminals, actions } = app;
  const width = layout.mainWidth;
  const bg = palette.frame;
  const termHeight = height - 1;

  const opened = React.useRef(false);
  React.useEffect(() => {
    terminals.setSize(width, termHeight);
    if (opened.current || terminals.shells.length > 0) return;
    opened.current = true;
    terminals.open();
  }, [terminals, width, termHeight]);

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
        {terminals.shells.map((shell) => {
          const on = shell.id === terminals.active?.id;
          const tabBg = on ? mix(bg, palette.text, 0.1) : bg;
          return (
            <box key={shell.id} flexDirection="row" height={1}>
              <Button
                segs={[
                  {
                    text: ` ${shell.status === 'running' ? '●' : '○'} `,
                    fg:
                      shell.status === 'running'
                        ? palette.process.running
                        : palette.faint,
                    bg: tabBg,
                  },
                  {
                    text: `${shell.title} `,
                    fg: on ? palette.text : palette.muted,
                    bg: tabBg,
                    bold: on,
                  },
                ]}
                bg={tabBg}
                hoverTint={palette.text}
                onPress={() => terminals.activate(shell.id)}
              />
              <Button
                segs={[{ text: '✕ ', fg: palette.faint, bg: tabBg }]}
                bg={tabBg}
                hoverTint={palette.deleted}
                onPress={() => terminals.close(shell.id)}
              />
            </box>
          );
        })}
        <Button
          segs={[{ text: ' + ', fg: palette.accent, bg }]}
          bg={bg}
          hoverTint={palette.accent}
          onPress={terminals.open}
        />
        <box flexGrow={1} height={1} backgroundColor={bg} />
      </box>
      {terminals.active ? (
        <TerminalView
          key={terminals.active.id}
          session={terminals.active}
          width={width}
          height={termHeight}
          captured={app.captured}
          onPress={() => actions.capture(true)}
        />
      ) : (
        <Line
          segs={[
            {
              text: '  No session open — press n',
              fg: palette.faint,
              italic: true,
            },
          ]}
          width={width}
          fill={bg}
        />
      )}
    </box>
  );
}
