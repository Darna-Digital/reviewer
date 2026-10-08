import { activeCommands, shownKey } from '../app/commands';
import { keyLabel } from '../app/keys';
import { NOTICE_MS } from '../app/useApp';
import type { App } from '../app/useApp';
import type { BottomTab } from '../app/useWorkspace';
import type { Palette } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

const NOTICE_GLYPH = { error: '✗ ', success: '✓ ', info: '· ' } as const;
const PANES: Array<{ tab: BottomTab; label: string }> = [
  { tab: 'history', label: '◷ History' },
  { tab: 'usages', label: '⌕ Usages' },
  { tab: 'run', label: '▶ Run' },
];
const MAX_HINTS = 3;

/** A notice, or what you are in and a few keys; then the bottom pane's tabs. */
export function BottomRail() {
  const app = useAppContext();
  const { palette, screen, services, actions, workspace } = app;
  const bg = palette.frame;
  const left = notice(app) ?? state(app) ?? hints(app);
  const running = services.running().length;

  return (
    <box
      flexDirection="row"
      height={1}
      width={screen.width}
      backgroundColor={bg}
    >
      <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
      {left.map((part, i) =>
        part.run ? (
          <Button
            key={i}
            segs={part.segs}
            bg={bg}
            hoverTint={palette.text}
            onPress={() => part.run?.(app)}
          />
        ) : (
          <Line
            key={i}
            segs={part.segs}
            width={Math.min(segsWidth(part.segs), screen.width - 40)}
            fill={bg}
          />
        ),
      )}
      <box flexGrow={1} height={1} backgroundColor={bg} />
      {PANES.map(({ tab, label }) => {
        const on = workspace.bottomOpen && workspace.bottomTab === tab;
        return (
          <Button
            key={tab}
            segs={[
              {
                text: ` ${label}`,
                fg: on ? palette.text : palette.faint,
                bold: on,
              },
              {
                text: tab === 'run' && running ? ` ●${running} ` : ' ',
                fg: palette.process.running,
              },
            ]}
            bg={bg}
            hoverTint={palette.text}
            onPress={() => actions.toggleBottomTab(tab)}
          />
        );
      })}
      <Button
        segs={[{ text: ' ? ', fg: palette.faint }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.openOverlay({ kind: 'help' })}
      />
    </box>
  );
}

interface Part {
  segs: Seg[];
  run?: (app: App) => void;
}

function notice(app: App): Part[] | null {
  const { notice: current } = app.review;
  if (!current || Date.now() - current.at >= NOTICE_MS) return null;
  const { palette } = app;
  const fg =
    current.kind === 'error'
      ? palette.deleted
      : current.kind === 'success'
        ? palette.added
        : palette.muted;
  return [{ segs: [{ text: NOTICE_GLYPH[current.kind] + current.text, fg }] }];
}

/** Where the keyboard is going when it is not the command table. */
function state(app: App): Part[] | null {
  const { palette } = app;
  if (app.captured)
    return [{ segs: keys(palette, '⌃O', 'stop typing into the service') }];
  if (app.typing === 'message')
    return [{ segs: keys(palette, 'esc', 'done  ', '⌃S', 'commit') }];
  if (app.typing) return [{ segs: keys(palette, 'esc', 'done') }];
  return null;
}

function hints(app: App): Part[] {
  return activeCommands(app)
    .flatMap((command) => {
      const key = shownKey(command, app.chords);
      return command.hint && key ? [{ command, key }] : [];
    })
    .slice(0, MAX_HINTS)
    .map(({ command, key }) => ({
      segs: keys(app.palette, keyLabel(key), `${command.hint}  `),
      run: (app: App) => command.run(app, 1),
    }));
}

function keys(palette: Palette, ...pairs: string[]): Seg[] {
  return pairs.map((text, i) => ({
    text: i % 2 === 0 ? `${text} ` : text,
    fg: i % 2 === 0 ? palette.muted : palette.faint,
  }));
}
