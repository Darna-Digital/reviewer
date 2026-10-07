import { useKeyboard } from '@opentui/react';
import { AppContext } from '../components/AppContext';
import { AppRail } from '../components/AppRail';
import { BottomPane } from '../components/BottomPane';
import { BottomRail } from '../components/BottomRail';
import { Composer } from '../components/Composer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContextMenu } from '../components/ContextMenu';
import { Divider } from '../components/Divider';
import { Editor } from '../components/Editor';
import { FormDialog } from '../components/FormDialog';
import { HelpOverlay } from '../components/HelpOverlay';
import {
  CommandPalette,
  CommentsPicker,
  FilePicker,
  SearchPicker,
} from '../components/Pickers';
import { Sidebar } from '../components/Sidebar';
import { TargetPicker } from '../components/TargetPicker';
import { TopRail } from '../components/TopRail';
import { findCommand } from './commands';
import { keyName } from './keys';
import { useApp } from './useApp';
import type { App as AppState, AppProps } from './useApp';

export function App(props: AppProps) {
  const app = useApp(props);
  useKeyboard((event) =>
    dispatchKey(app, keyName(event), () => event.preventDefault()),
  );

  const { overlay, palette, screen, workspace, layout } = app;
  return (
    <AppContext.Provider value={app}>
      <box
        width={screen.width}
        height={screen.height}
        flexDirection="column"
        backgroundColor={palette.frame}
      >
        <TopRail />
        <box
          flexDirection="row"
          height={layout.bodyHeight}
          width={screen.width}
        >
          <AppRail />
          {workspace.sidebarVisible ? (
            <>
              <Sidebar />
              <Divider />
            </>
          ) : null}
          <box
            flexDirection="column"
            width={layout.mainWidth}
            height={layout.bodyHeight}
          >
            <Editor />
            {workspace.bottomOpen ? <BottomPane /> : null}
          </box>
        </box>
        {overlay?.kind === 'compose' ? <Composer overlay={overlay} /> : null}
        <BottomRail />
        {overlay?.kind === 'targets' ? <TargetPicker /> : null}
        {overlay?.kind === 'files' ? <FilePicker /> : null}
        {overlay?.kind === 'palette' ? <CommandPalette /> : null}
        {overlay?.kind === 'search' ? <SearchPicker /> : null}
        {overlay?.kind === 'comments' ? <CommentsPicker /> : null}
        {overlay?.kind === 'confirm' ? (
          <ConfirmDialog overlay={overlay} />
        ) : null}
        {overlay?.kind === 'form' ? <FormDialog overlay={overlay} /> : null}
        {overlay?.kind === 'menu' ? <ContextMenu overlay={overlay} /> : null}
        {overlay?.kind === 'help' ? <HelpOverlay /> : null}
      </box>
    </AppContext.Provider>
  );
}

/**
 * Routes a key: overlays own their keys, a captured terminal gets everything
 * but `ctrl+o`, a focused text field everything but Esc/Return (and the
 * commit keys), and the command table the rest.
 */
function dispatchKey(app: AppState, key: string, consume: () => void) {
  const { actions } = app;
  if (key === 'ctrl+c' && !app.captured) return actions.quit();
  if (app.overlay) return;
  if (app.captured) {
    if (key === 'ctrl+o') {
      consume();
      actions.capture(false);
    }
    return;
  }
  if (app.typing) {
    if (app.typing === 'message' && key === 'ctrl+s') {
      consume();
      actions.setTyping(null);
      return void app.commit.commit();
    }
    if (app.typing === 'message' && key === 'ctrl+g') {
      consume();
      return void app.commit.generate();
    }
    if (key === 'escape' || (key === 'return' && app.typing !== 'message')) {
      consume();
      actions.setTyping(null);
    }
    return;
  }
  const command = findCommand(app, key);
  if (!command) return;
  consume();
  command.run(app);
}
