import type { App } from './useApp';

export type Scope =
  | 'global'
  | 'tree'
  | 'commit'
  | 'diff'
  | 'viewer'
  | 'history'
  | 'usages'
  | 'run';

export interface Command {
  id: string;
  keys: string[];
  title: string;
  /** Short status-bar label; commands without one stay out of the bar. */
  hint?: string;
  scope: Scope;
  /** Offered in the command palette. */
  palette?: boolean;
  when?: (app: App) => boolean;
  /** `count` is the vim count typed before the key; 1 without one. */
  run: (app: App, count: number) => void;
}

export const HELP_GROUPS: Array<{ title: string; scopes: Scope[] }> = [
  { title: 'Anywhere', scopes: ['global'] },
  { title: 'Sidebar', scopes: ['tree', 'commit'] },
  { title: 'Diff & file', scopes: ['diff', 'viewer'] },
  { title: 'Bottom pane', scopes: ['history', 'run'] },
];

const onCard = (app: App) => app.activeView.stop?.target.kind === 'comment';
const onFileHeader = (app: App) => app.diff.stop?.target.kind === 'file';
const inCommit = (app: App) => app.review.comparison.kind === 'commit';
const isSplit = (app: App) => app.diff.view === 'split';
const onCode = (app: App) => app.activeView.stop?.target.kind === 'line';
const unwrapped = (app: App) => !app.activeView.wrap;
const SIDEWAYS_KEY_STEP = 8;
const cardComment = (app: App) => {
  const stop = app.activeView.stop;
  return stop?.target.kind === 'comment' ? stop.target.comment : undefined;
};

export const COMMANDS: Command[] = [
  // anywhere
  {
    id: 'help',
    scope: 'global',
    keys: ['?'],
    title: 'keys',
    run: (app) => app.actions.openOverlay({ kind: 'help' }),
  },
  {
    id: 'palette',
    scope: 'global',
    keys: ['cmd+e', 'ctrl+k', ':'],
    title: 'command palette',
    run: (app) => app.actions.openPalette('commands'),
  },
  {
    id: 'quit',
    scope: 'global',
    keys: ['q'],
    title: 'quit',
    palette: true,
    run: (app) => app.actions.quit(),
  },
  {
    id: 'focus.next',
    scope: 'global',
    keys: ['tab'],
    title: 'next pane',
    run: (app) => app.actions.focusNext(1),
  },
  {
    id: 'focus.prev',
    scope: 'global',
    keys: ['shift+tab'],
    title: 'previous pane',
    run: (app) => app.actions.focusNext(-1),
  },
  {
    id: 'jump.back',
    scope: 'global',
    keys: ['ctrl+o', 'alt+left'],
    title: 'back to where you jumped from',
    palette: true,
    run: (app) => app.actions.jumpBack(),
  },
  {
    id: 'jump.forward',
    scope: 'global',
    keys: ['alt+right'],
    title: 'forward again',
    palette: true,
    run: (app) => app.actions.jumpForward(),
  },
  {
    id: 'surface.browse',
    scope: 'global',
    keys: ['alt+cmd+1'],
    title: 'browse the project',
    palette: true,
    run: (app) => app.actions.setSurface('browse'),
  },
  {
    id: 'surface.review',
    scope: 'global',
    keys: ['alt+cmd+2'],
    title: 'review changes',
    palette: true,
    run: (app) => app.actions.setSurface('review'),
  },
  {
    id: 'surface.toggle',
    scope: 'global',
    keys: ['cmd+g'],
    title: 'switch browse ⇄ review',
    palette: true,
    run: (app) =>
      app.actions.setSurface(
        app.workspace.surface === 'review' ? 'browse' : 'review',
      ),
  },
  {
    id: 'branch.pick',
    scope: 'global',
    keys: ['alt+cmd+4'],
    title: 'switch branch…',
    palette: true,
    run: (app) => app.actions.openBranches(),
  },
  {
    id: 'bottom.history',
    scope: 'global',
    keys: ['alt+cmd+5'],
    title: 'history pane',
    palette: true,
    run: (app) => app.actions.toggleBottomTab('history'),
  },
  {
    id: 'bottom.usages',
    scope: 'global',
    keys: ['alt+cmd+6'],
    title: 'usages pane',
    palette: true,
    run: (app) => app.actions.toggleBottomTab('usages'),
  },
  {
    id: 'symbol.outline',
    scope: 'global',
    keys: ['@'],
    title: 'go to symbol in file…',
    palette: true,
    run: (app) => void app.actions.outline(),
  },
  {
    id: 'bottom.run',
    scope: 'global',
    keys: ['alt+cmd+7'],
    title: 'run pane (services)',
    palette: true,
    run: (app) => app.actions.toggleBottomTab('run'),
  },
  {
    id: 'bottom.toggle',
    scope: 'global',
    keys: ['cmd+b', 'ctrl+b'],
    title: 'show / hide bottom pane',
    palette: true,
    run: (app) => app.actions.toggleBottom(),
  },
  {
    id: 'sidebar.toggle',
    scope: 'global',
    keys: ['ctrl+cmd+s', '\\'],
    title: 'show / hide sidebar',
    palette: true,
    run: (app) => app.actions.toggleSidebar(),
  },
  {
    id: 'target.pick',
    scope: 'global',
    keys: ['t'],
    title: 'compare against…',
    hint: 'target',
    palette: true,
    run: (app) => app.actions.openTargets(),
  },
  {
    id: 'target.toggle',
    scope: 'global',
    keys: ['T'],
    title: 'uncommitted ⇄ last branch',
    palette: true,
    run: (app) => app.actions.toggleTarget(),
  },
  {
    id: 'file.find',
    scope: 'global',
    keys: ['cmd+shift+o', 'ctrl+shift+o', 'ctrl+p', 'p'],
    title: 'go to file…',
    hint: 'file',
    palette: true,
    run: (app) => app.actions.openPalette('files'),
  },
  {
    id: 'search',
    scope: 'global',
    keys: ['cmd+shift+f', 'ctrl+shift+f', '/'],
    title: 'search in files…',
    palette: true,
    run: (app) => app.actions.openPalette('text'),
  },
  {
    id: 'comments.list',
    scope: 'global',
    keys: ['m'],
    title: 'all comments…',
    palette: true,
    run: (app) => app.actions.openOverlay({ kind: 'comments' }),
  },
  {
    id: 'view.split',
    scope: 'global',
    keys: ['s'],
    title: 'split / unified diff',
    palette: true,
    run: (app) =>
      app.diff.setView((v) => (v === 'split' ? 'unified' : 'split')),
  },
  {
    id: 'view.fullFiles',
    scope: 'global',
    keys: ['E'],
    title: 'full files / changed hunks',
    palette: true,
    run: (app) => app.workspace.toggleFullFiles(),
  },
  {
    id: 'view.wrap',
    scope: 'global',
    keys: ['alt+z', 'W'],
    title: 'wrap long lines',
    palette: true,
    run: (app) => app.activeView.setWrap((w) => !w),
  },
  {
    id: 'view.comments',
    scope: 'global',
    keys: ['C'],
    title: 'show / hide comments',
    palette: true,
    run: (app) => app.activeView.setShowComments((s) => !s),
  },
  {
    id: 'theme.pick',
    scope: 'global',
    keys: ['cmd+,', 'ctrl+,', 'ctrl+t'],
    title: 'theme & appearance…',
    palette: true,
    run: (app) => app.actions.openOverlay({ kind: 'theme' }),
  },
  {
    id: 'theme.appearance',
    scope: 'global',
    keys: [],
    title: 'cycle appearance: system · light · dark',
    palette: true,
    run: (app) => {
      const appearance = app.themes.cycleAppearance();
      app.review.notify('info', `Appearance: ${appearance}`);
    },
  },
  {
    id: 'view.icons',
    scope: 'global',
    keys: [],
    title: 'show / hide file icons (needs a Nerd Font)',
    palette: true,
    run: (app) =>
      app.themes.updateSettings({
        fileIcons: !app.themes.settings.fileIcons,
      }),
  },
  {
    id: 'git.fetch',
    scope: 'global',
    keys: ['F'],
    title: 'fetch',
    palette: true,
    run: (app) => void app.actions.fetch(),
  },
  {
    id: 'git.pull',
    scope: 'global',
    keys: ['L'],
    title: 'pull',
    palette: true,
    run: (app) => void app.actions.pull(),
  },
  {
    id: 'git.push',
    scope: 'global',
    keys: ['P'],
    title: 'push',
    palette: true,
    run: (app) => void app.actions.push(),
  },
  {
    id: 'git.branch',
    scope: 'global',
    keys: [],
    title: 'create branch…',
    palette: true,
    run: (app) => app.actions.newBranch(),
  },
  {
    id: 'service.add',
    scope: 'global',
    keys: [],
    title: 'add a service…',
    palette: true,
    run: (app) => app.actions.addService(),
  },
  {
    id: 'services.startAll',
    scope: 'global',
    keys: [],
    title: 'start all services',
    palette: true,
    run: (app) => app.services.startAll(),
  },
  {
    id: 'services.stopAll',
    scope: 'global',
    keys: [],
    title: 'stop all services',
    palette: true,
    run: (app) => app.services.stopAll(),
  },
  {
    id: 'refresh',
    scope: 'global',
    keys: ['cmd+r', 'ctrl+r', 'r'],
    title: 'refresh',
    palette: true,
    run: (app) => app.actions.refresh(),
  },

  // sidebar tree
  {
    id: 'tree.down',
    scope: 'tree',
    keys: ['j', 'down'],
    title: 'next row',
    run: (app, count) => app.tree.step(count),
  },
  {
    id: 'tree.up',
    scope: 'tree',
    keys: ['k', 'up'],
    title: 'previous row',
    run: (app, count) => app.tree.step(-count),
  },
  {
    id: 'tree.pageDown',
    scope: 'tree',
    keys: ['ctrl+d', 'pagedown'],
    title: 'ten down',
    run: (app) => app.tree.step(10),
  },
  {
    id: 'tree.pageUp',
    scope: 'tree',
    keys: ['ctrl+u', 'pageup'],
    title: 'ten up',
    run: (app) => app.tree.step(-10),
  },
  {
    id: 'tree.top',
    scope: 'tree',
    keys: ['g', 'home'],
    title: 'first',
    run: (app) => app.tree.step(-Infinity),
  },
  {
    id: 'tree.bottom',
    scope: 'tree',
    keys: ['G', 'end'],
    title: 'last',
    run: (app) => app.tree.step(Infinity),
  },
  {
    id: 'tree.open',
    scope: 'tree',
    keys: ['return', 'l', 'right'],
    title: 'open file / expand folder',
    hint: 'open',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (node) app.actions.openTreeNode(node);
    },
  },
  {
    id: 'tree.close',
    scope: 'tree',
    keys: ['h', 'left'],
    title: 'collapse / go to parent',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (!node) return;
      if (node.kind === 'dir' && app.tree.isOpen(node))
        return app.tree.setOpen(node, false);
      const parent = app.tree.parentOf(node.path);
      if (parent) app.tree.select(parent.path);
    },
  },
  {
    id: 'tree.filter',
    scope: 'tree',
    keys: ['f'],
    title: 'filter changed files',
    when: (app) => app.workspace.surface === 'review',
    run: (app) => app.actions.setTyping('treeFilter'),
  },
  {
    id: 'tree.discard',
    scope: 'tree',
    keys: ['x'],
    title: 'discard changes…',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (node) app.actions.discard(node);
    },
  },
  {
    id: 'tree.copy',
    scope: 'tree',
    keys: ['y'],
    title: 'copy path',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (node) app.actions.copy(node.path);
    },
  },
  {
    id: 'tree.history',
    scope: 'tree',
    keys: ['H'],
    title: 'show file history',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (node?.kind === 'file') app.actions.showHistoryFor(node.path);
    },
  },

  // commit composer (review of your own changes)
  {
    id: 'commit.toggle',
    scope: 'commit',
    keys: ['space'],
    title: 'include / leave out of commit',
    hint: 'include',
    run: (app) => {
      const node = app.tree.selectedNode;
      if (node)
        app.commit.toggle(
          node.files.filter((path) => app.commit.paths.includes(path)),
        );
    },
  },
  {
    id: 'commit.all',
    scope: 'commit',
    keys: ['A'],
    title: 'include all / none',
    run: (app) => app.commit.toggleAll(),
  },
  {
    id: 'commit.message',
    scope: 'commit',
    keys: ['i'],
    title: 'write the message',
    hint: 'message',
    run: (app) => app.actions.setTyping('message'),
  },
  {
    id: 'commit.generate',
    scope: 'commit',
    keys: ['ctrl+g'],
    title: 'generate message with Claude',
    hint: 'generate',
    palette: true,
    run: (app) => void app.commit.generate(),
  },
  {
    id: 'commit.commit',
    scope: 'commit',
    keys: ['cmd+return', 'ctrl+s'],
    title: 'commit',
    hint: 'commit',
    palette: true,
    run: (app) => void app.commit.commit(),
  },
  {
    id: 'commit.agent',
    scope: 'commit',
    keys: [],
    title: 'commit message agent…',
    palette: true,
    run: (app) =>
      app.actions.commitAgentMenu({
        x: 1,
        y: app.layout.bodyHeight - app.layout.commitBoxHeight,
      }),
  },
  {
    id: 'commit.push',
    scope: 'commit',
    keys: [],
    title: 'commit and push',
    palette: true,
    run: (app) => void app.commit.commit({ andPush: true }),
  },

  // diff
  {
    id: 'diff.down',
    scope: 'diff',
    keys: ['j', 'down'],
    title: 'next line',
    run: (app, count) => app.diff.moveBy(count),
  },
  {
    id: 'diff.up',
    scope: 'diff',
    keys: ['k', 'up'],
    title: 'previous line',
    run: (app, count) => app.diff.moveBy(-count),
  },
  {
    id: 'diff.pageDown',
    scope: 'diff',
    keys: ['ctrl+d', 'pagedown', 'space'],
    title: 'half page down',
    run: (app) => app.diff.page(1),
  },
  {
    id: 'diff.pageUp',
    scope: 'diff',
    keys: ['ctrl+u', 'pageup'],
    title: 'half page up',
    run: (app) => app.diff.page(-1),
  },
  {
    id: 'diff.top',
    scope: 'diff',
    keys: ['g', 'home'],
    title: 'top',
    run: (app) => app.diff.toTop(),
  },
  {
    id: 'diff.bottom',
    scope: 'diff',
    keys: ['G', 'end'],
    title: 'bottom',
    run: (app) => app.diff.toBottom(),
  },
  {
    id: 'diff.nextFile',
    scope: 'diff',
    keys: [']'],
    title: 'next file',
    hint: 'file',
    run: (app) => app.diff.nextFile(),
  },
  {
    id: 'diff.prevFile',
    scope: 'diff',
    keys: ['['],
    title: 'previous file',
    run: (app) => app.diff.prevFile(),
  },
  {
    id: 'diff.nextHunk',
    scope: 'diff',
    keys: ['}'],
    title: 'next hunk',
    hint: 'hunk',
    run: (app) => app.diff.nextHunk(),
  },
  {
    id: 'diff.prevHunk',
    scope: 'diff',
    keys: ['{'],
    title: 'previous hunk',
    run: (app) => app.diff.prevHunk(),
  },
  ...(['diff', 'viewer'] as const).flatMap((scope): Command[] => [
    {
      id: `${scope}.scrollLeft`,
      scope,
      keys: ['left'],
      title: 'scroll left (wrap off)',
      when: unwrapped,
      run: (app) => app.activeView.scrollXBy(-SIDEWAYS_KEY_STEP),
    },
    {
      id: `${scope}.scrollRight`,
      scope,
      keys: ['right'],
      title: 'scroll right (wrap off)',
      when: unwrapped,
      run: (app) => app.activeView.scrollXBy(SIDEWAYS_KEY_STEP),
    },
  ]),
  {
    id: 'diff.left',
    scope: 'diff',
    keys: ['h', 'left'],
    title: 'old side',
    when: isSplit,
    run: (app) => app.diff.setSide('left'),
  },
  {
    id: 'diff.right',
    scope: 'diff',
    keys: ['l', 'right'],
    title: 'new side',
    when: isSplit,
    run: (app) => app.diff.setSide('right'),
  },
  {
    id: 'diff.fold',
    scope: 'diff',
    keys: ['z'],
    title: 'fold file',
    run: (app) => {
      const file = app.diff.stop
        ? app.review.files[app.diff.stop.file]
        : undefined;
      if (file) app.diff.toggleFold(file);
    },
  },
  {
    id: 'diff.headerFold',
    scope: 'diff',
    keys: ['return'],
    title: 'fold (on a file header)',
    when: onFileHeader,
    run: (app) => {
      const file = app.diff.stop
        ? app.review.files[app.diff.stop.file]
        : undefined;
      if (file) app.diff.toggleFold(file);
    },
  },
  {
    id: 'diff.back',
    scope: 'diff',
    keys: ['escape'],
    title: 'back from a commit',
    hint: 'back',
    when: inCommit,
    run: (app) => app.actions.back(),
  },

  // file viewer
  {
    id: 'viewer.down',
    scope: 'viewer',
    keys: ['j', 'down'],
    title: 'next line',
    run: (app, count) => app.editor.viewer.moveBy(count),
  },
  {
    id: 'viewer.up',
    scope: 'viewer',
    keys: ['k', 'up'],
    title: 'previous line',
    run: (app, count) => app.editor.viewer.moveBy(-count),
  },
  {
    id: 'viewer.pageDown',
    scope: 'viewer',
    keys: ['ctrl+d', 'pagedown', 'space'],
    title: 'half page down',
    run: (app) => app.editor.viewer.page(1),
  },
  {
    id: 'viewer.pageUp',
    scope: 'viewer',
    keys: ['ctrl+u', 'pageup'],
    title: 'half page up',
    run: (app) => app.editor.viewer.page(-1),
  },
  {
    id: 'viewer.top',
    scope: 'viewer',
    keys: ['g', 'home'],
    title: 'top',
    run: (app) => app.editor.viewer.toTop(),
  },
  {
    id: 'viewer.bottom',
    scope: 'viewer',
    keys: ['G', 'end'],
    title: 'bottom',
    run: (app) => app.editor.viewer.toBottom(),
  },
  {
    id: 'viewer.nextSymbol',
    scope: 'viewer',
    keys: ['}'],
    title: 'next definition (or paragraph)',
    run: (app) => void app.actions.jumpSymbol(1),
  },
  {
    id: 'viewer.prevSymbol',
    scope: 'viewer',
    keys: ['{'],
    title: 'previous definition (or paragraph)',
    run: (app) => void app.actions.jumpSymbol(-1),
  },
  {
    id: 'viewer.nextTab',
    scope: 'viewer',
    keys: ['cmd+shift+]', ']'],
    title: 'next tab',
    hint: 'tab',
    run: (app) => app.editor.step(1),
  },
  {
    id: 'viewer.prevTab',
    scope: 'viewer',
    keys: ['cmd+shift+[', '['],
    title: 'previous tab',
    run: (app) => app.editor.step(-1),
  },
  {
    id: 'viewer.close',
    scope: 'viewer',
    keys: ['cmd+w', 'ctrl+w'],
    title: 'close tab',
    hint: 'close',
    run: (app) => {
      if (app.editor.active) app.editor.close(app.editor.active);
    },
  },

  // comments, in the diff and the viewer alike
  ...(['diff', 'viewer'] as const).flatMap((scope): Command[] => [
    {
      id: `${scope}.wordNext`,
      scope,
      keys: ['w'],
      title: 'next symbol',
      run: (app) => app.activeView.wordStep(1),
    },
    {
      id: `${scope}.wordPrev`,
      scope,
      keys: ['b'],
      title: 'previous symbol',
      run: (app) => app.activeView.wordStep(-1),
    },
    {
      id: `${scope}.wordFirst`,
      scope,
      keys: ['0'],
      title: 'first symbol on the line',
      run: (app) => app.activeView.wordEdge('first'),
    },
    {
      id: `${scope}.wordLast`,
      scope,
      keys: ['$'],
      title: 'last symbol on the line',
      run: (app) => app.activeView.wordEdge('last'),
    },
    {
      id: `${scope}.occurrenceNext`,
      scope,
      keys: ['*'],
      title: 'next use of the symbol',
      run: (app) => app.actions.occurrence(1),
    },
    {
      id: `${scope}.occurrencePrev`,
      scope,
      keys: ['#'],
      title: 'previous use of the symbol',
      run: (app) => app.actions.occurrence(-1),
    },
    {
      id: `${scope}.definition`,
      scope,
      keys: ['return'],
      title: 'go to definition',
      hint: 'definition',
      when: onCode,
      run: (app) => {
        const spot = app.actions.wordSpot();
        if (spot) void app.actions.goToDefinition(spot);
      },
    },
    {
      id: `${scope}.info`,
      scope,
      keys: ['K'],
      title: 'symbol info',
      run: (app) => {
        const spot = app.actions.wordSpot();
        if (spot) app.actions.showInfo(spot);
      },
    },
    {
      id: `${scope}.usages`,
      scope,
      keys: ['u'],
      title: 'find usages',
      hint: 'usages',
      when: onCode,
      run: (app) => {
        const spot = app.actions.wordSpot();
        if (spot) app.actions.findUsages(spot);
      },
    },
    {
      id: `${scope}.symbol`,
      scope,
      keys: ['.'],
      title: 'symbol on this line…',
      hint: 'symbol',
      palette: scope === 'diff',
      run: (app) => app.actions.symbolsOnLine(),
    },
    {
      id: `${scope}.comment`,
      scope,
      keys: ['c'],
      title: 'comment on the line',
      hint: 'comment',
      run: (app) => app.actions.compose(),
    },
    {
      id: `${scope}.nextComment`,
      scope,
      keys: ['n'],
      title: 'next comment',
      run: (app) => {
        if (!app.activeView.nextComment())
          app.review.notify('info', 'No more comments');
      },
    },
    {
      id: `${scope}.prevComment`,
      scope,
      keys: ['N'],
      title: 'previous comment',
      run: (app) => app.activeView.prevComment(),
    },
    {
      id: `${scope}.edit`,
      scope,
      keys: ['e', 'return'],
      title: 'edit comment',
      hint: 'edit',
      when: onCard,
      run: (app) => {
        const comment = cardComment(app);
        if (comment) app.actions.editComment(comment);
      },
    },
    {
      id: `${scope}.delete`,
      scope,
      keys: ['x'],
      title: 'delete comment',
      hint: 'delete',
      when: onCard,
      run: (app) => {
        const comment = cardComment(app);
        if (comment) app.actions.deleteComment(comment);
      },
    },
  ]),

  // usages pane
  {
    id: 'usages.down',
    scope: 'usages',
    keys: ['j', 'down'],
    title: 'next usage',
    run: (app, count) => app.symbols.stepUsage(count),
  },
  {
    id: 'usages.up',
    scope: 'usages',
    keys: ['k', 'up'],
    title: 'previous usage',
    run: (app, count) => app.symbols.stepUsage(-count),
  },
  {
    id: 'usages.open',
    scope: 'usages',
    keys: ['return'],
    title: 'open the usage',
    hint: 'open',
    run: (app) => {
      if (app.symbols.selectedUsage)
        app.actions.openUsage(app.symbols.selectedUsage);
    },
  },
  {
    id: 'usages.rerun',
    scope: 'usages',
    keys: ['r'],
    title: 'search again',
    hint: 'again',
    run: (app) => void app.symbols.rerun(),
  },

  // history pane
  {
    id: 'history.down',
    scope: 'history',
    keys: ['j', 'down'],
    title: 'older commit',
    run: (app, count) => app.actions.stepHistory(count),
  },
  {
    id: 'history.up',
    scope: 'history',
    keys: ['k', 'up'],
    title: 'newer commit',
    run: (app, count) => app.actions.stepHistory(-count),
  },
  {
    id: 'history.show',
    scope: 'history',
    keys: ['return'],
    title: 'show the commit',
    hint: 'show',
    run: (app) => {
      if (app.history.selectedSha)
        app.actions.showCommit(app.history.selectedSha);
    },
  },
  {
    id: 'history.all',
    scope: 'history',
    keys: ['a'],
    title: 'all branches / HEAD',
    hint: 'all',
    run: (app) => app.history.toggleAll(),
  },
  {
    id: 'history.filter',
    scope: 'history',
    keys: ['f'],
    title: 'filter by text or hash',
    hint: 'filter',
    run: (app) => app.actions.setTyping('historyFilter'),
  },
  {
    id: 'history.clear',
    scope: 'history',
    keys: ['escape'],
    title: 'clear filters',
    when: (app) => !!app.history.query || !!app.history.path,
    run: (app) => {
      app.history.setQuery('');
      app.history.setPath(null);
    },
  },
  {
    id: 'history.copy',
    scope: 'history',
    keys: ['y'],
    title: 'copy hash',
    run: (app) => {
      if (app.history.selectedSha) app.actions.copy(app.history.selectedSha);
    },
  },

  // run pane
  {
    id: 'run.down',
    scope: 'run',
    keys: ['j', 'down'],
    title: 'next service',
    run: (app) => stepService(app, 1),
  },
  {
    id: 'run.up',
    scope: 'run',
    keys: ['k', 'up'],
    title: 'previous service',
    run: (app) => stepService(app, -1),
  },
  {
    id: 'run.scrollLeft',
    scope: 'run',
    keys: ['left'],
    title: 'scroll the commands left',
    run: (app) => app.services.scrollTable(-SIDEWAYS_KEY_STEP),
  },
  {
    id: 'run.scrollRight',
    scope: 'run',
    keys: ['right'],
    title: 'scroll the commands right',
    run: (app) => app.services.scrollTable(SIDEWAYS_KEY_STEP),
  },
  {
    id: 'run.toggle',
    scope: 'run',
    keys: ['return', 'space'],
    title: 'start / stop',
    hint: 'start/stop',
    run: (app) => {
      if (app.services.selected) app.services.toggle(app.services.selected.id);
    },
  },
  {
    id: 'run.restart',
    scope: 'run',
    keys: ['R'],
    title: 'restart',
    hint: 'restart',
    run: (app) => {
      if (app.services.selected) app.services.start(app.services.selected.id);
    },
  },
  {
    id: 'run.add',
    scope: 'run',
    keys: ['a', '+'],
    title: 'add a service…',
    hint: 'add',
    run: (app) => app.actions.addService(),
  },
  {
    id: 'run.remove',
    scope: 'run',
    keys: ['d', '-'],
    title: 'remove service…',
    run: (app) => {
      if (app.services.selected)
        app.actions.removeService(app.services.selected);
    },
  },
  {
    id: 'run.startAll',
    scope: 'run',
    keys: ['A'],
    title: 'start all',
    run: (app) => app.services.startAll(),
  },
  {
    id: 'run.stopAll',
    scope: 'run',
    keys: ['X'],
    title: 'stop all',
    run: (app) => app.services.stopAll(),
  },
  {
    id: 'run.type',
    scope: 'run',
    keys: ['i'],
    title: 'type into its output',
    run: (app) => app.actions.capture(true),
  },
];

const NEEDS_KITTY = /cmd\+|ctrl\+shift\+|ctrl\+,/;

/**
 * The key to show for a command: its ⌘ chord where the terminal speaks the
 * kitty keyboard protocol, otherwise the first key any terminal can send.
 */
export function shownKey(
  command: Command,
  chords: boolean,
): string | undefined {
  return chords
    ? command.keys[0]
    : command.keys.find((key) => !NEEDS_KITTY.test(key));
}

/** Commands live right now, most specific scope first. */
export function activeCommands(app: App): Command[] {
  return scopesFor(app).flatMap((scope) =>
    COMMANDS.filter(
      (command) => command.scope === scope && (command.when?.(app) ?? true),
    ),
  );
}

export function findCommand(app: App, key: string): Command | undefined {
  return activeCommands(app).find((command) => command.keys.includes(key));
}

function scopesFor(app: App): Scope[] {
  switch (app.focus) {
    case 'sidebar':
      return app.isCommitMode
        ? ['commit', 'tree', 'global']
        : ['tree', 'global'];
    case 'main':
      return [app.workspace.surface === 'review' ? 'diff' : 'viewer', 'global'];
    case 'bottom':
      return [app.workspace.bottomTab, 'global'];
  }
}

function stepService(app: App, delta: number) {
  const { commands, selected } = app.services;
  const index = commands.findIndex((command) => command.id === selected?.id);
  const next =
    commands[Math.max(0, Math.min(commands.length - 1, index + delta))];
  if (next) app.services.select(next.id);
}
