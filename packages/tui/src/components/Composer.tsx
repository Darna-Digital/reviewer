import { useKeyboard } from '@opentui/react';
import { keyName } from '../app/keys';
import { COMPOSER_HEIGHT } from '../app/useApp';
import type { Overlay } from '../app/useApp';
import { popoverPlacement } from '../diff/popoverPlacement';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { Backdrop } from './Modal';

type ComposeOverlay = Extract<Overlay, { kind: 'compose' }>;

/**
 * A popover under the line being commented on, lined up with the comment
 * cards. ⏎ saves, ⇧⏎ / ⌥⏎ / ^J break the line, esc cancels.
 */
export function Composer({ overlay }: { overlay: ComposeOverlay }) {
  const app = useAppContext();
  const { palette, screen, actions, layout, activeView } = app;
  const { anchor, editing, replyTo } = overlay;
  const onGitHub = replyTo !== null || overlay.target.startsWith('pr-');

  useKeyboard((event) => {
    if (keyName(event) !== 'escape') return;
    event.preventDefault();
    actions.closeOverlay();
  });

  const stop = activeView.stop;
  const place = stop
    ? popoverPlacement({
        stop,
        paneTop: layout.contentTop,
        scrollTop: activeView.top,
        paneLeft: layout.mainLeft,
        paneWidth: layout.mainWidth,
        geometry: activeView.layout.geometry,
        view: activeView.view,
        side: anchor.side,
        height: COMPOSER_HEIGHT,
        screen: { top: 0, bottom: screen.height - 1 },
        over: editing !== null,
      })
    : {
        left: layout.mainLeft,
        top: layout.contentTop,
        width: layout.mainWidth,
      };
  const inner = place.width - 2;
  const bg = palette.popover;

  return (
    <>
      <Backdrop
        onPress={() => {
          if (!app.commentBox.current?.plainText.trim()) actions.closeOverlay();
        }}
        zIndex={24}
      />
      <box
        position="absolute"
        left={place.left}
        top={place.top}
        width={place.width}
        height={COMPOSER_HEIGHT}
        zIndex={25}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={bg}
        flexDirection="column"
      >
        <textarea
          ref={app.commentBox}
          focused
          initialValue={editing?.body ?? ''}
          placeholder={
            replyTo
              ? `Reply to ${replyTo.author} on GitHub…`
              : onGitHub
                ? 'Comment on GitHub…'
                : 'Leave a comment…'
          }
          height={COMPOSER_HEIGHT - 3}
          backgroundColor={bg}
          focusedBackgroundColor={bg}
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
          <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
          <Button
            segs={[
              {
                text: editing
                  ? ' ⏎ save '
                  : replyTo
                    ? ' ⏎ reply '
                    : ' ⏎ comment ',
                fg: palette.accentInk,
                bg: palette.accent,
                bold: true,
              },
            ]}
            bg={palette.accent}
            hoverTint={palette.text}
            onPress={actions.submitComposer}
          />
          <Line segs={[{ text: '  ' }]} width={2} fill={bg} />
          <Button
            segs={[
              { text: ' esc cancel ', fg: palette.muted, bg: palette.control },
            ]}
            bg={palette.control}
            hoverTint={palette.text}
            onPress={actions.closeOverlay}
          />
          <Line
            segs={[{ text: '   ⇧⏎ · ^J new line', fg: palette.faint }]}
            width={Math.max(0, inner - 26)}
            fill={bg}
          />
        </box>
      </box>
    </>
  );
}
