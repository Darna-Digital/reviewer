import { useKeyboard } from '@opentui/react';
import { keyName } from '../app/keys';
import type { Overlay } from '../app/useApp';
import { wrapProse } from '../text/measure';
import { useAppContext } from './AppContext';
import { Backdrop, centered } from './Modal';
import { Button, Line } from './Line';

type ConfirmOverlay = Extract<Overlay, { kind: 'confirm' }>;

/** Border, the blank rows around the message, and the buttons. */
const CHROME_ROWS = 6;

export function ConfirmDialog({ overlay }: { overlay: ConfirmOverlay }) {
  const { palette, screen, actions } = useAppContext();
  const width = Math.min(60, screen.width - 4);
  const inner = width - 2;
  const detail = wrapProse(overlay.detail, inner - 4).slice(
    0,
    Math.max(1, screen.height - CHROME_ROWS - 2),
  );
  const height = detail.length + CHROME_ROWS;

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'y' || key === 'return') confirm();
    else if (key === 'n' || key === 'escape' || key === 'q')
      actions.closeOverlay();
    else return;
    event.preventDefault();
  });

  return (
    <>
      <Backdrop onPress={actions.closeOverlay} zIndex={29} />
      <box
        position="absolute"
        left={centered(screen.width, width)}
        top={centered(screen.height, height)}
        width={width}
        height={height}
        zIndex={30}
        border
        borderStyle="rounded"
        borderColor={palette.warning}
        backgroundColor={palette.popover}
        title={` ${overlay.title} `}
        flexDirection="column"
      >
        <Line segs={[]} width={inner} fill={palette.popover} />
        {detail.map((line, index) => (
          <Line
            key={index}
            segs={[{ text: `  ${line}`, fg: palette.text }]}
            width={inner}
            fill={palette.popover}
          />
        ))}
        <Line segs={[]} width={inner} fill={palette.popover} />
        <box flexDirection="row" height={1}>
          <Line segs={[{ text: '  ' }]} width={2} fill={palette.popover} />
          <Button
            segs={[
              {
                text: ` y ${overlay.confirmLabel} `,
                fg: palette.accentInk,
                bg: palette.warning,
                bold: true,
              },
            ]}
            bg={palette.warning}
            hoverTint={palette.text}
            onPress={confirm}
          />
          <Line segs={[{ text: '   ' }]} width={3} fill={palette.popover} />
          <Button
            segs={[
              { text: ' n cancel ', fg: palette.text, bg: palette.control },
            ]}
            bg={palette.control}
            hoverTint={palette.text}
            onPress={actions.closeOverlay}
          />
          <box flexGrow={1} backgroundColor={palette.popover} />
        </box>
      </box>
    </>
  );

  function confirm() {
    overlay.run();
    actions.closeOverlay();
  }
}
