import type { DevCommand } from '@reviewer/core/local-dev';
import * as React from 'react';
import {
  SERVICE_NAME_COLUMN,
  SERVICE_STATUS_COLUMN,
  processDot,
  serviceColumns,
  serviceItems,
  statusLabel,
} from '../render/listItems';
import { mix } from '../render/palette';
import { sliceSegs } from '../render/styled';
import { padEnd, truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { List } from './List';
import { TerminalView } from './TerminalView';

const TABLE_SHARE = 0.42;
const GAPS = 8;

/** Services: a table on the left, the selected one's live output on the right. */
export function RunPane({
  height,
  focused,
}: {
  height: number;
  focused: boolean;
}) {
  const app = useAppContext();
  const { palette, layout, services, actions } = app;
  const width = layout.mainWidth;
  const bg = palette.frame;
  const tableWidth = Math.max(36, Math.round(width * TABLE_SHARE));
  const detailWidth = width - tableWidth - 1;
  const anyRunning = services.running().length > 0;
  const contentWidth = Math.max(tableWidth, naturalWidth(services.commands));
  const maxScroll = contentWidth - tableWidth;
  const scrollX = Math.min(services.tableScroll, maxScroll);

  React.useEffect(() => {
    services.clampTable(maxScroll);
  }, [services, maxScroll]);

  React.useEffect(() => {
    services.setSize(detailWidth, height - 2);
  }, [services, detailWidth, height]);

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
        <ToolButton label=" + Add " onPress={actions.addService} />
        <ToolButton
          label=" − Remove "
          disabled={!services.selected}
          onPress={() =>
            services.selected && actions.removeService(services.selected)
          }
        />
        <Line segs={[{ text: ' │ ', fg: palette.rule }]} width={3} fill={bg} />
        <ToolButton
          label=" ▶ Start all "
          disabled={services.commands.length === 0}
          onPress={services.startAll}
        />
        <ToolButton
          label=" ■ Stop all "
          disabled={!anyRunning}
          onPress={services.stopAll}
        />
        <box flexGrow={1} height={1} backgroundColor={bg} />
      </box>
      {services.commands.length === 0 ? (
        <EmptyRun height={height - 1} />
      ) : (
        <box flexDirection="row" height={height - 1} width={width}>
          <box flexDirection="column" width={tableWidth} height={height - 1}>
            <TableHeader
              width={tableWidth}
              contentWidth={contentWidth}
              scrollX={scrollX}
            />
            <List
              items={serviceItems(palette, services.commands, (id) => ({
                status: services.statusOf(id),
                exitCode: services.exitCodeOf(id),
              }))}
              selected={services.commands.findIndex(
                (command) => command.id === services.selected?.id,
              )}
              focused={focused && !app.captured}
              width={tableWidth}
              contentWidth={contentWidth}
              scrollX={scrollX}
              onScrollX={services.scrollTable}
              height={height - 2}
              palette={palette}
              emptyText="No commands"
              onSelect={(item) => {
                actions.setFocus('bottom');
                actions.capture(false);
                if (item.value) services.select(item.value.id);
              }}
              onActivate={(item) =>
                item.value && services.toggle(item.value.id)
              }
              onContextMenu={(item, at) =>
                item.value && actions.serviceMenu(item.value, at)
              }
            />
          </box>
          <box
            width={1}
            height={height - 1}
            border={['left']}
            borderStyle="single"
            borderColor={palette.rule}
            backgroundColor={bg}
          />
          <Detail width={detailWidth} height={height - 1} />
        </box>
      )}
    </box>
  );
}

function TableHeader({
  width,
  contentWidth,
  scrollX,
}: {
  width: number;
  contentWidth: number;
  scrollX: number;
}) {
  const { palette } = useAppContext();
  const columns = serviceColumns(contentWidth);
  return (
    <Line
      segs={sliceSegs(
        [
          {
            text: `   ${padEnd('NAME', columns.name)} `,
            fg: palette.faint,
            bold: true,
          },
          {
            text: `${padEnd('COMMAND', columns.command)} `,
            fg: palette.faint,
            bold: true,
          },
          {
            text: padEnd('STATUS', columns.status),
            fg: palette.faint,
            bold: true,
          },
          { text: 'FOLDER', fg: palette.faint, bold: true },
        ],
        scrollX,
        width,
        palette.frame,
      )}
      width={width}
      fill={palette.frame}
    />
  );
}

function Detail({ width, height }: { width: number; height: number }) {
  const app = useAppContext();
  const { palette, services, actions } = app;
  const command = services.selected;
  const bg = mix(palette.frame, palette.text, 0.03);
  if (!command) {
    return (
      <Placeholder
        width={width}
        height={height}
        title="No command selected"
        detail="Pick a command on the left to see its output."
      />
    );
  }
  const status = services.statusOf(command.id);
  const exitCode = services.exitCodeOf(command.id);
  const session = services.sessionOf(command.id);
  const running = status === 'running';
  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
        <Line
          segs={[
            { text: ' ', bg },
            processDot(palette, status, exitCode, bg),
            { text: ` ${command.name} `, fg: palette.text, bg, bold: true },
            {
              text: truncate(
                command.command,
                Math.max(8, width - command.name.length - 40),
              ),
              fg: palette.muted,
              bg,
            },
            { text: `  ▸ ${command.cwd || '.'}`, fg: palette.faint, bg },
          ]}
          width={Math.max(10, width - 30)}
          fill={bg}
        />
        <box flexGrow={1} height={1} backgroundColor={bg} />
        <Line
          segs={[
            {
              text: `${statusLabel(status, exitCode)} `,
              fg: exitCode ? palette.deleted : palette.faint,
              bg,
            },
          ]}
          width={statusLabel(status, exitCode).length + 1}
          fill={bg}
        />
        {running || status === 'exited' ? (
          <ToolButton
            label=" ⟳ Restart "
            onPress={() => services.start(command.id)}
          />
        ) : null}
        {running ? (
          <ToolButton
            label=" ■ Stop "
            onPress={() => services.stop(command.id)}
          />
        ) : status === 'stopped' ? (
          <ToolButton
            label=" ▶ Start "
            onPress={() => services.start(command.id)}
          />
        ) : null}
      </box>
      {session && status !== 'stopped' ? (
        <TerminalView
          key={command.id}
          session={session}
          width={width}
          height={height - 1}
          captured={app.captured}
          onPress={() => actions.capture(true)}
        />
      ) : (
        <Placeholder
          width={width}
          height={height - 1}
          title="Not running"
          detail="Start it to see its output here."
          action={{ label: ' ▶ Start ', run: () => services.start(command.id) }}
        />
      )}
    </box>
  );
}

function EmptyRun({ height }: { height: number }) {
  const { layout, actions } = useAppContext();
  return (
    <Placeholder
      width={layout.mainWidth}
      height={height}
      title="No commands"
      detail="Add a dev server or a watcher to run in this project."
      action={{ label: ' + Add command… ', run: actions.addService }}
    />
  );
}

interface PlaceholderProps {
  width: number;
  height: number;
  title: string;
  detail: string;
  action?: { label: string; run: () => void };
}

function Placeholder({
  width,
  height,
  title,
  detail,
  action,
}: PlaceholderProps) {
  const { palette } = useAppContext();
  const bg = palette.frame;
  const top = Math.max(0, Math.floor(height / 2) - 2);
  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
      alignItems="center"
    >
      <box height={top} />
      <Line
        segs={[{ text: title, fg: palette.text, bold: true }]}
        width={title.length}
        fill={bg}
      />
      <Line
        segs={[{ text: detail, fg: palette.faint }]}
        width={detail.length}
        fill={bg}
      />
      {action ? (
        <>
          <box height={1} />
          <ToolButton label={action.label} onPress={action.run} />
        </>
      ) : null}
    </box>
  );
}

function ToolButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useAppContext();
  const bg = palette.control;
  return (
    <box flexDirection="row" height={1}>
      <Button
        segs={[
          { text: label, fg: disabled ? palette.faint : palette.text, bg },
        ]}
        bg={bg}
        hoverTint={disabled ? bg : palette.text}
        onPress={() => !disabled && onPress()}
      />
      <Line segs={[{ text: ' ' }]} width={1} fill={palette.frame} />
    </box>
  );
}

/** Wide enough that no command or folder is cut: the name column, status and gaps besides. */
function naturalWidth(commands: DevCommand[]): number {
  const longest = (pick: (command: DevCommand) => string) =>
    Math.max(0, ...commands.map((command) => pick(command).length));
  return (
    longest((c) => c.command) +
    SERVICE_NAME_COLUMN +
    SERVICE_STATUS_COLUMN +
    GAPS +
    longest((c) => c.cwd || '.')
  );
}
