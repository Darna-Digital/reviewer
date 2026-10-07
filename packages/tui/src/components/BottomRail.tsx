import { activeCommands, shownKey } from '../app/commands';
import { keyLabel } from '../app/keys';
import { NOTICE_MS } from '../app/useApp';
import type { App } from '../app/useApp';
import type { BottomTab } from '../app/useWorkspace';
import { processDot } from '../render/listItems';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

const NOTICE_GLYPH = { error: '✗ ', success: '✓ ', info: '· ' } as const;
const PANES: Array<{ tab: BottomTab; label: string }> = [
  { tab: 'history', label: '◷ History' },
  { tab: 'terminal', label: '❯ Terminal' },
  { tab: 'run', label: '▶ Run' },
];
const MAX_HINTS = 6;

/** Mode, a notice or the live keys; the bottom pane's tabs; the services. */
export function BottomRail() {
  const app = useAppContext();
  const { palette, screen, review, services, actions, workspace } = app;
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
    : activeCommands(app)
        .flatMap((command) => {
          const key = shownKey(command, app.chords);
          return command.hint && key ? [{ command, key }] : [];
        })
        .slice(0, MAX_HINTS);
  const noticeColor =
    notice?.kind === 'error'
      ? palette.deleted
      : notice?.kind === 'success'
        ? palette.added
        : palette.accent;

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
              fg: noticeColor,
              bg,
            },
          ]}
          width={Math.min(
            segsWidth([{ text: notice.text }]) + 2,
            Math.round(screen.width * 0.6),
          )}
          fill={bg}
        />
      ) : (
        hints.map(({ command, key }) => (
          <Button
            key={command.id}
            segs={[
              {
                text: keyLabel(key),
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
      {PANES.map(({ tab, label }) => {
        const on = workspace.bottomOpen && workspace.bottomTab === tab;
        const paneBg = on ? palette.selection : bg;
        const running = tab === 'run' ? services.running().length : 0;
        return (
          <Button
            key={tab}
            segs={[
              {
                text: ` ${label}`,
                fg: on ? palette.text : palette.muted,
                bg: paneBg,
                bold: on,
              },
              {
                text: running ? ` ●${running} ` : ' ',
                fg: palette.process.running,
                bg: paneBg,
              },
            ]}
            bg={paneBg}
            hoverTint={palette.text}
            onPress={() => actions.toggleBottomTab(tab)}
          />
        );
      })}
      <Line segs={[{ text: ' │ ', fg: palette.rule }]} width={3} fill={bg} />
      {services.commands.slice(0, 5).map((command) => (
        <Button
          key={command.id}
          segs={[
            processDot(
              palette,
              services.statusOf(command.id),
              services.exitCodeOf(command.id),
              bg,
            ),
            {
              text: ` ${truncate(command.name, 14)}  `,
              fg:
                services.statusOf(command.id) === 'running'
                  ? palette.text
                  : palette.faint,
              bg,
            },
          ]}
          bg={bg}
          hoverTint={palette.text}
          onPress={() => {
            services.select(command.id);
            app.workspace.openBottom('run');
            actions.setFocus('bottom');
          }}
        />
      ))}
      {services.commands.length > 0 ? (
        <Line segs={[{ text: '│', fg: palette.rule }]} width={1} fill={bg} />
      ) : null}
      <Button
        segs={[{ text: ' ? keys ', fg: palette.faint, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.openOverlay({ kind: 'help' })}
      />
    </box>
  );
}

function modeLabel(app: App): string {
  if (app.captured) return 'TERMINAL';
  if (app.typing === 'message') return 'MESSAGE';
  if (app.typing) return 'FILTER';
  switch (app.overlay?.kind) {
    case 'compose':
      return 'COMMENT';
    case 'confirm':
    case 'form':
    case 'menu':
      return 'ACTION';
    case 'help':
      return 'HELP';
    case undefined:
      break;
    default:
      return 'PICK';
  }
  if (app.focus === 'sidebar') return app.isCommitMode ? 'COMMIT' : 'FILES';
  if (app.focus === 'bottom') return app.workspace.bottomTab.toUpperCase();
  return app.workspace.surface === 'review' ? 'DIFF' : 'FILE';
}
