import { EmbeddedTerminalRenderable } from '@opentui/core';
import { extend } from '@opentui/react';
import * as React from 'react';
import type { PtySession } from '../process/ptySession';

extend({ 'embedded-terminal': EmbeddedTerminalRenderable });

declare module '@opentui/react' {
  interface OpenTUIComponents {
    'embedded-terminal': typeof EmbeddedTerminalRenderable;
  }
}

export interface TerminalViewProps {
  session: PtySession;
  width: number;
  height: number;
  /** Keys go to the process while captured. */
  captured: boolean;
  onPress?: () => void;
}

/** A process's pseudo-terminal drawn by OpenTUI's emulator; scrollback replays on attach. */
export function TerminalView({
  session,
  width,
  height,
  captured,
  onPress,
}: TerminalViewProps) {
  const ref = React.useRef<EmbeddedTerminalRenderable | null>(null);
  const cols = Math.max(10, width);
  const rows = Math.max(2, height);

  React.useEffect(() => {
    const view = ref.current;
    if (!view) return;
    return session.attach((data) => view.write(data));
  }, [session]);

  React.useEffect(() => {
    session.resize(cols, rows);
  }, [session, cols, rows]);

  React.useEffect(() => {
    if (captured) ref.current?.focus();
    else ref.current?.blur();
  }, [captured]);

  return (
    <embedded-terminal
      ref={ref}
      cols={cols}
      rows={rows}
      width={cols}
      height={rows}
      onData={(data, source) => {
        if (source === 'input' || source === 'response') session.write(data);
      }}
      onMouseDown={onPress}
    />
  );
}
