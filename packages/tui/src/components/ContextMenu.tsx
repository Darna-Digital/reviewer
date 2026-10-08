import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { keyName } from '../app/keys';
import type { MenuEntry, Overlay } from '../app/useApp';
import { cellWidth } from '../text/measure';
import { useAppContext } from './AppContext';
import { Line } from './Line';
import { Backdrop } from './Modal';

type MenuOverlay = Extract<Overlay, { kind: 'menu' }>;
type MenuItem = Exclude<MenuEntry, { separator: true }>;

const isItem = (entry: MenuEntry): entry is MenuItem => !('separator' in entry);

/** A right-click menu at the pointer; arrows and Return work too. */
export function ContextMenu({ overlay }: { overlay: MenuOverlay }) {
  const { palette, screen, actions } = useAppContext();
  const items = overlay.entries.filter(isItem);
  const enabled = items.filter((item) => !item.disabled);
  const [index, setIndex] = React.useState(0);
  const lit = enabled[Math.min(index, enabled.length - 1)];

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'escape' || (key === 'left' && overlay.under))
      actions.dismissMenu();
    else if (key === 'down' || key === 'j')
      setIndex((i) => Math.min(enabled.length - 1, i + 1));
    else if (key === 'up' || key === 'k') setIndex((i) => Math.max(0, i - 1));
    else if ((key === 'return' || key === 'right') && lit) run(lit);
    else return;
    event.preventDefault();
  });

  const width = Math.min(
    screen.width - 2,
    4 + Math.max(...items.map((item) => cellWidth(item.label))) + 2,
  );
  const height = overlay.entries.length + 2;
  const left = Math.max(0, Math.min(overlay.at.x, screen.width - width));
  const top = Math.max(0, Math.min(overlay.at.y, screen.height - height));

  return (
    <>
      <Backdrop onPress={actions.dismissMenu} zIndex={59} />
      <box
        position="absolute"
        left={left}
        top={top}
        width={width}
        height={height}
        zIndex={60}
        border
        borderStyle="rounded"
        borderColor={palette.rule}
        backgroundColor={palette.popover}
        flexDirection="column"
      >
        {overlay.entries.map((entry, i) => {
          if (!isItem(entry)) {
            return (
              <Line
                key={i}
                segs={[{ text: '─'.repeat(width - 2), fg: palette.hairline }]}
                width={width - 2}
                fill={palette.popover}
              />
            );
          }
          const on = entry === lit;
          const bg = on ? palette.selection : palette.popover;
          const fg = entry.disabled
            ? palette.faint
            : entry.danger
              ? palette.deleted
              : palette.text;
          return (
            <Line
              key={i}
              segs={[{ text: ` ${entry.label}`, fg, bg }]}
              width={width - 2}
              fill={bg}
              onMouseOver={() =>
                !entry.disabled && setIndex(enabled.indexOf(entry))
              }
              onMouseDown={() => !entry.disabled && run(entry)}
            />
          );
        })}
      </box>
    </>
  );

  function run(item: MenuItem) {
    actions.closeOverlay();
    item.run();
  }
}
