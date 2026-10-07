import { activeCommands } from '../app/commands';
import { keyLabel } from '../app/keys';
import { NOTICE_MS } from '../app/useApp';
import type { App } from '../app/useApp';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

const NOTICE_GLYPH = { error: '✗ ', success: '✓ ', info: '· ' } as const;

/** Mode, then a notice or the live commands as buttons; view toggles on the right. */
export function StatusBar() {
  const app = useAppContext();
  const { palette, screen, review, diff } = app;
  const bg = palette.frame;
  const mode: Seg[] = [
    {
      text: ` ${modeLabel(app)} `,
      fg: palette.accentInk,
      bg: palette.accent,
      bold: true,
    },
    { text: ' ', bg },
  ];
  const notice =
    review.notice && Date.now() - review.notice.at < NOTICE_MS
      ? review.notice
      : null;
  const hints = notice
    ? []
    : activeCommands(app).filter((command) => command.hint);
  const position =
    review.files.length > 0
      ? `file ${(diff.stop?.file ?? 0) + 1}/${review.files.length}  `
      : '';

  const toggles: Array<{ label: string; on: boolean; run: () => void }> = [
    {
      label: diff.view,
      on: true,
      run: () => diff.setView((v) => (v === 'unified' ? 'split' : 'unified')),
    },
    { label: 'wrap', on: diff.wrap, run: () => diff.setWrap((w) => !w) },
    {
      label: 'comments',
      on: diff.showComments,
      run: () => diff.setShowComments((s) => !s),
    },
  ];

  return (
    <box
      flexDirection="row"
      height={1}
      width={screen.width}
      backgroundColor={bg}
    >
      <Line segs={mode} width={segsWidth(mode)} fill={bg} />
      {notice ? (
        <Line
          segs={[
            {
              text: NOTICE_GLYPH[notice.kind] + notice.text,
              fg: noticeColor(app, notice.kind),
              bg,
            },
          ]}
          width={Math.max(0, screen.width - segsWidth(mode) - 40)}
          fill={bg}
        />
      ) : (
        hints.map((command) => (
          <Button
            key={command.id}
            segs={[
              {
                text: keyLabel(command.keys[0]!),
                fg: palette.muted,
                bg,
                bold: true,
              },
              { text: ` ${command.hint}  `, fg: palette.faint, bg },
            ]}
            bg={bg}
            hoverTint={palette.text}
            onPress={() => command.run(app)}
          />
        ))
      )}
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {toggles.map((toggle) => (
        <Button
          key={toggle.label}
          segs={[
            {
              text: ` ${toggle.label} `,
              fg: toggle.on ? palette.muted : palette.faint,
              bg,
              bold: toggle.on,
            },
          ]}
          bg={bg}
          hoverTint={palette.text}
          onPress={toggle.run}
        />
      ))}
      <Line
        segs={[{ text: `  ${position}`, fg: palette.faint, bg }]}
        width={position.length + 2}
        fill={bg}
      />
      <Button
        segs={[{ text: '? keys ', fg: palette.faint, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => app.actions.openOverlay({ kind: 'help' })}
      />
    </box>
  );
}

function modeLabel(app: App): string {
  switch (app.overlay?.kind) {
    case 'compose':
      return 'COMMENT';
    case 'confirm':
      return 'CONFIRM';
    case 'help':
      return 'HELP';
    case 'targets':
    case 'files':
      return 'PICK';
    default:
      return app.focus === 'diff' ? 'DIFF' : app.sidebar.tab.toUpperCase();
  }
}

function noticeColor(app: App, kind: 'error' | 'success' | 'info'): string {
  const { palette } = app;
  return kind === 'error'
    ? palette.deleted
    : kind === 'success'
      ? palette.added
      : palette.accent;
}
