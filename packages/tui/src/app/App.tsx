import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { AppContext } from '../components/AppContext';
import { Composer } from '../components/Composer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiffPane } from '../components/DiffPane';
import { Divider } from '../components/Divider';
import { FilePicker } from '../components/FilePicker';
import { Header } from '../components/Header';
import { HelpOverlay } from '../components/HelpOverlay';
import { Sidebar } from '../components/Sidebar';
import { StatusBar } from '../components/StatusBar';
import { TargetPicker } from '../components/TargetPicker';
import { findCommand } from './commands';
import { keyName } from './keys';
import { useApp } from './useApp';
import type { AppProps } from './useApp';

export function App(props: AppProps) {
  const app = useApp(props);
  const dragging = React.useRef(false);

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'ctrl+c') return app.actions.quit();
    // open overlays handle their own keys
    if (app.overlay) return;
    findCommand(app, key)?.run(app);
  });

  const { overlay, palette, screen, sidebar } = app;
  return (
    <AppContext.Provider value={app}>
      <box
        width={screen.width}
        height={screen.height}
        flexDirection="column"
        backgroundColor={palette.frame}
        onMouseDrag={(event) => {
          if (dragging.current) sidebar.resize(event.x);
        }}
        onMouseUp={() => {
          dragging.current = false;
        }}
      >
        <Header />
        <box flexDirection="row" height={app.bodyHeight} width={screen.width}>
          {sidebar.visible ? (
            <>
              <Sidebar />
              <Divider onDragStart={() => (dragging.current = true)} />
            </>
          ) : null}
          <DiffPane />
        </box>
        {overlay?.kind === 'compose' ? <Composer overlay={overlay} /> : null}
        <StatusBar />
        {overlay?.kind === 'targets' ? <TargetPicker /> : null}
        {overlay?.kind === 'files' ? <FilePicker /> : null}
        {overlay?.kind === 'confirm' ? (
          <ConfirmDialog overlay={overlay} />
        ) : null}
        {overlay?.kind === 'help' ? <HelpOverlay /> : null}
      </box>
    </AppContext.Provider>
  );
}
