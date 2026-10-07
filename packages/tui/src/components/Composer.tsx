import { useKeyboard } from '@opentui/react';
import { keyName } from '../app/keys';
import { COMPOSER_HEIGHT } from '../app/useApp';
import type { Overlay } from '../app/useApp';
import { agoLong } from '../text/time';
import type { Palette } from '../render/palette';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

type ComposeOverlay = Extract<Overlay, { kind: 'compose' }>;

/** Docked above the status bar; ⏎ saves, ⌥⏎ or ^J breaks the line. */
export function Composer({ overlay }: { overlay: ComposeOverlay }) {
  const app = useAppContext();
  const { palette, screen, actions } = app;
  const { anchor, editing } = overlay;
  const inner = screen.width - 2;

  useKeyboard((event) => {
    if (keyName(event) !== 'escape') return;
    event.preventDefault();
    actions.closeOverlay();
  });

  const title = `${editing ? 'Edit comment' : 'Comment'} · ${anchor.filePath}:${anchor.lineNumber}${
    anchor.side === 'deletions' ? ' (old)' : ''
  }`;

  return (
    <box
      height={COMPOSER_HEIGHT}
      width={screen.width}
      border
      borderStyle="rounded"
      borderColor={palette.accent}
      backgroundColor={palette.control}
      title={` ${title} `}
      flexDirection="column"
    >
      <Line
        segs={contextSegs(palette, overlay)}
        width={inner}
        fill={palette.control}
      />
      <textarea
        ref={app.textarea}
        focused
        initialValue={editing?.body ?? ''}
        placeholder="Leave a comment…"
        height={COMPOSER_HEIGHT - 4}
        backgroundColor={palette.control}
        focusedBackgroundColor={palette.control}
        textColor={palette.text}
        focusedTextColor={palette.text}
        placeholderColor={palette.faint}
        cursorColor={palette.accent}
        wrapMode="word"
        keyBindings={[
          { name: 'return', action: 'submit' },
          { name: 'return', meta: true, action: 'newline' },
          { name: 'return', shift: true, action: 'newline' },
          { name: 'j', ctrl: true, action: 'newline' },
        ]}
        onSubmit={actions.submitComposer}
      />
      <box flexDirection="row" height={1}>
        <Line segs={[{ text: ' ' }]} width={1} fill={palette.control} />
        <Button
          segs={[
            {
              text: ' ⏎ save ',
              fg: palette.accentInk,
              bg: palette.accent,
              bold: true,
            },
          ]}
          bg={palette.accent}
          hoverTint={palette.text}
          onPress={actions.submitComposer}
        />
        <Line segs={[{ text: '  ' }]} width={2} fill={palette.control} />
        <Button
          segs={[
            { text: ' esc cancel ', fg: palette.muted, bg: palette.popover },
          ]}
          bg={palette.popover}
          hoverTint={palette.text}
          onPress={actions.closeOverlay}
        />
        <Line
          segs={[{ text: '   ⌥⏎ / ^J new line', fg: palette.faint }]}
          width={Math.max(0, inner - 23)}
          fill={palette.control}
        />
      </box>
    </box>
  );
}

function contextSegs(palette: Palette, overlay: ComposeOverlay): Seg[] {
  if (overlay.editing) {
    return [
      {
        text: ` Editing your note from ${agoLong(overlay.editing.createdAt)}`,
        fg: palette.faint,
        italic: true,
      },
    ];
  }
  const { line } = overlay;
  if (!line)
    return [
      {
        text: ' Adding to the discussion on this line',
        fg: palette.faint,
        italic: true,
      },
    ];
  const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';
  const color =
    line.kind === 'add'
      ? palette.added
      : line.kind === 'del'
        ? palette.deleted
        : palette.faint;
  return [
    { text: ` ${sign} `, fg: color, bold: true },
    { text: line.text.trim(), fg: palette.muted },
  ];
}
