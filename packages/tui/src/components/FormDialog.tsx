import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { keyName } from '../app/keys';
import type { Overlay } from '../app/useApp';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { Backdrop, centered } from './Modal';

type FormOverlay = Extract<Overlay, { kind: 'form' }>;

/** A small form: tab moves between fields, Return submits, Esc cancels. */
export function FormDialog({ overlay }: { overlay: FormOverlay }) {
  const { palette, screen, actions } = useAppContext();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      overlay.fields.map((field) => [field.key, field.initial ?? '']),
    ),
  );
  const [active, setActive] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const width = Math.min(64, screen.width - 4);
  const inner = width - 2;
  const height = overlay.fields.length * 2 + 5;

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'escape') actions.closeOverlay();
    else if (key === 'tab' || key === 'down')
      setActive((i) => (i + 1) % overlay.fields.length);
    else if (key === 'shift+tab' || key === 'up')
      setActive((i) => (i - 1 + overlay.fields.length) % overlay.fields.length);
    else if (key === 'return') submit();
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
        borderColor={palette.accent}
        backgroundColor={palette.popover}
        title={` ${overlay.title} `}
        flexDirection="column"
      >
        {overlay.fields.map((field, i) => (
          <box key={field.key} flexDirection="column" height={2}>
            <Line
              segs={[
                {
                  text: ` ${field.label}`,
                  fg: i === active ? palette.accent : palette.muted,
                  bold: i === active,
                },
              ]}
              width={inner}
              fill={palette.popover}
            />
            <box
              flexDirection="row"
              height={1}
              onMouseDown={() => setActive(i)}
            >
              <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
              <input
                focused={i === active}
                value={values[field.key] ?? ''}
                placeholder={field.placeholder ?? ''}
                onInput={(value) =>
                  setValues((all) => ({ ...all, [field.key]: value }))
                }
                width={inner - 2}
                backgroundColor={palette.control}
                focusedBackgroundColor={palette.control}
                textColor={palette.text}
                focusedTextColor={palette.text}
                placeholderColor={palette.faint}
                cursorColor={palette.accent}
              />
            </box>
          </box>
        ))}
        <Line
          segs={[{ text: error ? ` ${error}` : '', fg: palette.deleted }]}
          width={inner}
          fill={palette.popover}
        />
        <box flexDirection="row" height={1}>
          <box flexGrow={1} backgroundColor={palette.popover} />
          <Button
            segs={[
              { text: ' Cancel ', fg: palette.muted, bg: palette.control },
            ]}
            bg={palette.control}
            hoverTint={palette.text}
            onPress={actions.closeOverlay}
          />
          <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
          <Button
            segs={[
              {
                text: ` ${overlay.submitLabel} `,
                fg: palette.accentInk,
                bg: palette.accent,
                bold: true,
              },
            ]}
            bg={palette.accent}
            hoverTint={palette.text}
            onPress={submit}
          />
          <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
        </box>
      </box>
    </>
  );

  function submit() {
    const problem = overlay.submit(values);
    if (problem) setError(problem);
    else actions.closeOverlay();
  }
}
