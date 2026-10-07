import { useKeyboard } from '@opentui/react';
import { COMMANDS, HELP_GROUPS } from '../app/commands';
import { keyLabel } from '../app/keys';
import { fitSegs } from '../render/styled';
import { padStart } from '../text/measure';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Backdrop, centered } from './Modal';
import { Line } from './Line';

const KEY_WIDTH = 10;
const MOUSE_HELP =
  ' click selects · double-click opens, comments, edits · wheel scrolls · drag the divider · click ⇄ to pick a target';

/** Every command, grouped, straight from the command table. */
export function HelpOverlay() {
  const { palette, screen, actions } = useAppContext();
  useKeyboard((event) => {
    event.preventDefault();
    actions.closeOverlay();
  });

  const width = Math.min(120, screen.width - 4);
  const inner = width - 2;
  const columns = inner >= 100 ? 3 : 1;
  const columnWidth = Math.floor(inner / columns);
  const blocks = HELP_GROUPS.map((group) => [
    [
      { text: ` ${group.title.toUpperCase()}`, fg: palette.accent, bold: true },
    ] as Seg[],
    ...uniqueByTitle(
      COMMANDS.filter((command) => group.scopes.includes(command.scope)),
    ).map((command): Seg[] => [
      {
        text: ` ${padStart(command.keys.slice(0, 2).map(keyLabel).join(' '), KEY_WIDTH - 1)}  `,
        fg: palette.text,
        bold: true,
      },
      { text: command.title, fg: palette.muted },
    ]),
  ]);

  const lines: Seg[][] =
    columns === 1
      ? blocks.flatMap((block, i) => (i === 0 ? block : [[], ...block]))
      : Array.from(
          { length: Math.max(...blocks.map((block) => block.length)) },
          (_, row) =>
            blocks.flatMap((block) =>
              fitSegs(block[row] ?? [], columnWidth, palette.popover),
            ),
        );
  const height = Math.min(screen.height - 2, lines.length + 5);

  return (
    <>
      <Backdrop onPress={actions.closeOverlay} zIndex={39} />
      <box
        position="absolute"
        left={centered(screen.width, width)}
        top={centered(screen.height, height)}
        width={width}
        height={height}
        zIndex={40}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={palette.popover}
        title=" Keys "
        flexDirection="column"
        onMouseDown={actions.closeOverlay}
      >
        <Line segs={[]} width={inner} fill={palette.popover} />
        {lines.slice(0, height - 5).map((segs, i) => (
          <Line key={i} segs={segs} width={inner} fill={palette.popover} />
        ))}
        <Line segs={[]} width={inner} fill={palette.popover} />
        <Line
          segs={[
            { text: ' MOUSE ', fg: palette.accent, bold: true },
            { text: MOUSE_HELP, fg: palette.muted },
            {
              text: '   · any key or click closes',
              fg: palette.faint,
              italic: true,
            },
          ]}
          width={inner}
          fill={palette.popover}
        />
      </box>
    </>
  );
}

function uniqueByTitle<TItem extends { title: string }>(
  items: TItem[],
): TItem[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.title) && seen.add(item.title));
}
