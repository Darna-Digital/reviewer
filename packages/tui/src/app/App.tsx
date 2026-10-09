import { useKeyboard, useRenderer } from '@opentui/react';
import * as React from 'react';
import { AppContext } from '../components/AppContext';
import { BranchPicker } from '../components/BranchPicker';
import { CommentsPopover } from '../components/CommentsPopover';
import { HoverCard } from '../components/HoverCard';
import {
  DefinitionPicker,
  LineSymbolPicker,
  OutlinePicker,
} from '../components/SymbolPickers';
import { BottomPane } from '../components/BottomPane';
import { BottomRail } from '../components/BottomRail';
import { Composer } from '../components/Composer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContextMenu } from '../components/ContextMenu';
import { Divider } from '../components/Divider';
import { Editor } from '../components/Editor';
import { FormDialog } from '../components/FormDialog';
import { HelpOverlay } from '../components/HelpOverlay';
import { CommandPalette } from '../components/CommandPalette';
import { CommentsPicker, ThemePicker } from '../components/Pickers';
import { PullsPicker } from '../components/PullsPicker';
import { Sidebar } from '../components/Sidebar';
import { TargetPicker } from '../components/TargetPicker';
import { findCommand } from './commands';
import { keyName } from './keys';
import { guardMouseFragments } from './mouseFragments';
import { useApp } from './useApp';
import type { App as AppState, AppProps } from './useApp';

export function App(props: AppProps) {
  const app = useApp(props);
  const renderer = useRenderer();
  const [fragments] = React.useState(() => guardMouseFragments(renderer));
  React.useEffect(() => fragments.dispose, [fragments]);
  const count = React.useRef(0);
  useKeyboard((event) =>
    dispatchKey(app, keyName(event), count, () => event.preventDefault()),
  );

  const { overlay, palette, screen, workspace, layout } = app;
  return (
    <AppContext.Provider value={app}>
      <box
        width={screen.width}
        height={screen.height}
        flexDirection="column"
        onMouseScroll={fragments.noteScroll}
        backgroundColor={palette.frame}
      >
        <box
          flexDirection="row"
          height={layout.bodyHeight}
          width={screen.width}
        >
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
        <BottomRail />
        {overlay?.kind === 'compose' ? <Composer overlay={overlay} /> : null}
        {overlay?.kind === 'targets' ? (
          <TargetPicker overlay={overlay} />
        ) : null}
        {overlay?.kind === 'branches' ? (
          <BranchPicker overlay={overlay} />
        ) : null}
        {overlay?.kind === 'menu' && overlay.under?.kind === 'branches' ? (
          <BranchPicker overlay={overlay.under} inert />
        ) : null}
        {overlay?.kind === 'menu' && overlay.under?.kind === 'lineSymbols' ? (
          <LineSymbolPicker overlay={overlay.under} inert />
        ) : null}
        {overlay?.kind === 'lineSymbols' ? (
          <LineSymbolPicker overlay={overlay} />
        ) : null}
        {overlay?.kind === 'definitions' ? (
          <DefinitionPicker overlay={overlay} />
        ) : null}
        {overlay?.kind === 'outline' ? (
          <OutlinePicker overlay={overlay} />
        ) : null}
        {app.symbols.hover && !overlay ? (
          <HoverCard card={app.symbols.hover} />
        ) : null}
        {overlay?.kind === 'palette' ? (
          <CommandPalette overlay={overlay} />
        ) : null}
        {overlay?.kind === 'theme' ? <ThemePicker /> : null}
        {overlay?.kind === 'comments' ? <CommentsPicker /> : null}
        {overlay?.kind === 'pulls' ? <PullsPicker /> : null}
        {overlay?.kind === 'commentsHere' ? (
          <CommentsPopover overlay={overlay} />
        ) : null}
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
 * Routes a key: overlays own their keys, a captured service gets everything
 * but `ctrl+o`, a focused text field everything but Esc/Return, the commit
 * keys and ⌘ chords, and the command table the rest.
 */
function dispatchKey(
  app: AppState,
  key: string,
  count: { current: number },
  consume: () => void,
) {
  const { actions } = app;
  const typed = count.current;
  count.current = 0;
  if (app.symbols.hover) {
    app.symbols.hideHover();
    if (key === 'escape') return consume();
  }
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
    if (
      app.typing === 'message' &&
      (key === 'ctrl+s' || key === 'cmd+return')
    ) {
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
      return;
    }
    if (!key.startsWith('cmd+')) return;
    actions.setTyping(null);
  }
  if (/^[0-9]$/.test(key) && (key !== '0' || typed > 0)) {
    consume();
    count.current = Math.min(MAX_COUNT, typed * 10 + Number(key));
    return;
  }
  const command = findCommand(app, key);
  if (!command) return;
  consume();
  command.run(app, Math.max(1, typed));
}

const MAX_COUNT = 9999;
