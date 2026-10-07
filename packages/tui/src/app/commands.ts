import type { App } from './useApp';
import type { Tab } from './useSidebar';

export type Scope = 'global' | 'diff' | 'list' | Tab;

export interface Command {
  id: string;
  keys: string[];
  title: string;
  /** Short label for the status bar; commands without one stay out of it. */
  hint?: string;
  scope: Scope;
  when?: (app: App) => boolean;
  run: (app: App) => void;
}

export const HELP_GROUPS: Array<{ title: string; scopes: Scope[] }> = [
  { title: 'Anywhere', scopes: ['global'] },
  { title: 'Diff', scopes: ['diff'] },
  {
    title: 'Lists',
    scopes: ['list', 'files', 'branches', 'history', 'comments'],
  },
];

const onCard = (app: App) => app.diff.stop?.target.kind === 'comment';
const onFileHeader = (app: App) => app.diff.stop?.target.kind === 'file';
const inCommit = (app: App) => app.review.comparison.kind === 'commit';
const isSplit = (app: App) => app.diff.view === 'split';
const selectedBranch = (app: App) => app.list.selectedItem?.branch;
const selectedComment = (app: App) => app.list.selectedItem?.comment;

export const COMMANDS: Command[] = [
  // anywhere
  {
    id: 'help',
    scope: 'global',
    keys: ['?'],
    title: 'this help',
    run: (app) => app.actions.openOverlay({ kind: 'help' }),
  },
  {
    id: 'quit',
    scope: 'global',
    keys: ['q'],
    title: 'quit',
    run: (app) => app.actions.quit(),
  },
  {
    id: 'tab.files',
    scope: 'global',
    keys: ['1'],
    title: 'files',
    run: (app) => app.actions.focusSidebar('files'),
  },
  {
    id: 'tab.branches',
    scope: 'global',
    keys: ['2'],
    title: 'branches',
    run: (app) => app.actions.focusSidebar('branches'),
  },
  {
    id: 'tab.history',
    scope: 'global',
    keys: ['3'],
    title: 'history',
    run: (app) => app.actions.focusSidebar('history'),
  },
  {
    id: 'tab.comments',
    scope: 'global',
    keys: ['4'],
    title: 'comments',
    run: (app) => app.actions.focusSidebar('comments'),
  },
  {
    id: 'focus',
    scope: 'global',
    keys: ['tab'],
    title: 'sidebar ⇄ diff',
    run: (app) => app.actions.toggleFocus(),
  },
  {
    id: 'target.pick',
    scope: 'global',
    keys: ['t'],
    title: 'compare against…',
    hint: 'target',
    run: (app) => app.actions.openOverlay({ kind: 'targets' }),
  },
  {
    id: 'target.toggle',
    scope: 'global',
    keys: ['T'],
    title: 'uncommitted ⇄ last branch',
    run: (app) => app.actions.toggleTarget(),
  },
  {
    id: 'file.find',
    scope: 'global',
    keys: ['p'],
    title: 'go to file…',
    run: (app) => app.actions.openOverlay({ kind: 'files' }),
  },
  {
    id: 'view.split',
    scope: 'global',
    keys: ['s'],
    title: 'split / unified',
    run: (app) =>
      app.diff.setView((v) => (v === 'unified' ? 'split' : 'unified')),
  },
  {
    id: 'view.wrap',
    scope: 'global',
    keys: ['w'],
    title: 'wrap long lines',
    run: (app) => app.diff.setWrap((w) => !w),
  },
  {
    id: 'sidebar',
    scope: 'global',
    keys: ['b'],
    title: 'toggle sidebar',
    run: (app) => app.actions.toggleSidebar(),
  },
  {
    id: 'comments.toggle',
    scope: 'global',
    keys: ['C'],
    title: 'toggle comments',
    run: (app) => app.diff.setShowComments((s) => !s),
  },
  {
    id: 'refresh',
    scope: 'global',
    keys: ['r'],
    title: 'refresh',
    run: (app) => app.actions.refresh(),
  },

  // diff
  {
    id: 'diff.down',
    scope: 'diff',
    keys: ['j', 'down'],
    title: 'next line',
    run: (app) => app.diff.moveBy(1),
  },
  {
    id: 'diff.up',
    scope: 'diff',
    keys: ['k', 'up'],
    title: 'previous line',
    run: (app) => app.diff.moveBy(-1),
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
  {
    id: 'diff.nextComment',
    scope: 'diff',
    keys: ['n'],
    title: 'next comment',
    run: (app) => {
      if (!app.diff.nextComment())
        app.review.notify('info', 'No more comments');
    },
  },
  {
    id: 'diff.prevComment',
    scope: 'diff',
    keys: ['N'],
    title: 'previous comment',
    run: (app) => app.diff.prevComment(),
  },
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
    id: 'diff.comment',
    scope: 'diff',
    keys: ['c'],
    title: 'comment on line',
    hint: 'comment',
    run: (app) => app.actions.compose(),
  },
  {
    id: 'diff.edit',
    scope: 'diff',
    keys: ['e', 'return'],
    title: 'edit comment',
    hint: 'edit',
    when: onCard,
    run: (app) => {
      const { stop } = app.diff;
      if (stop?.target.kind === 'comment')
        app.actions.editComment(stop.target.comment);
    },
  },
  {
    id: 'diff.delete',
    scope: 'diff',
    keys: ['x'],
    title: 'delete comment',
    hint: 'delete',
    when: onCard,
    run: (app) => {
      const { stop } = app.diff;
      if (stop?.target.kind === 'comment')
        app.actions.deleteComment(stop.target.comment);
    },
  },
  {
    id: 'diff.fold',
    scope: 'diff',
    keys: ['z'],
    title: 'fold file',
    hint: 'fold',
    when: (app) => !onCard(app),
    run: (app) => {
      const file = app.diff.stop
        ? app.review.files[app.diff.stop.file]
        : undefined;
      if (file) app.diff.toggleFold(file);
    },
  },
  {
    id: 'diff.openFile',
    scope: 'diff',
    keys: ['return'],
    title: 'fold file (on its header)',
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
    title: 'back from commit',
    hint: 'back',
    when: inCommit,
    run: (app) => app.actions.back(),
  },

  // lists
  {
    id: 'list.down',
    scope: 'list',
    keys: ['j', 'down'],
    title: 'next item',
    run: (app) => app.actions.stepSelection(1),
  },
  {
    id: 'list.up',
    scope: 'list',
    keys: ['k', 'up'],
    title: 'previous item',
    run: (app) => app.actions.stepSelection(-1),
  },
  {
    id: 'list.pageDown',
    scope: 'list',
    keys: ['ctrl+d', 'pagedown'],
    title: 'ten down',
    run: (app) => app.actions.stepSelection(10),
  },
  {
    id: 'list.pageUp',
    scope: 'list',
    keys: ['ctrl+u', 'pageup'],
    title: 'ten up',
    run: (app) => app.actions.stepSelection(-10),
  },
  {
    id: 'list.top',
    scope: 'list',
    keys: ['g', 'home'],
    title: 'first',
    run: (app) => app.actions.stepSelection(-Infinity),
  },
  {
    id: 'list.bottom',
    scope: 'list',
    keys: ['G', 'end'],
    title: 'last',
    run: (app) => app.actions.stepSelection(Infinity),
  },
  {
    id: 'list.open',
    scope: 'list',
    keys: ['return', 'l', 'right'],
    title: 'open selection',
    hint: 'open',
    run: (app) => app.actions.activate(),
  },
  {
    id: 'list.leave',
    scope: 'list',
    keys: ['escape', 'h', 'left'],
    title: 'back to diff',
    run: (app) => app.setFocus('diff'),
  },
  {
    id: 'branch.checkout',
    scope: 'branches',
    keys: ['o'],
    title: 'check out branch',
    hint: 'checkout',
    run: (app) => {
      const branch = selectedBranch(app);
      if (branch) app.actions.confirmCheckout(branch);
    },
  },
  {
    id: 'branch.aim',
    scope: 'branches',
    keys: ['m'],
    title: 'set as branch target',
    hint: 'set target',
    run: (app) => app.actions.setAimToSelection(),
  },
  {
    id: 'history.all',
    scope: 'history',
    keys: ['a'],
    title: 'all branches / HEAD',
    hint: 'all',
    run: (app) => app.review.setLogAll((all) => !all),
  },
  {
    id: 'comment.edit',
    scope: 'comments',
    keys: ['e'],
    title: 'edit comment',
    hint: 'edit',
    run: (app) => {
      const comment = selectedComment(app);
      if (comment) app.actions.editComment(comment);
    },
  },
  {
    id: 'comment.delete',
    scope: 'comments',
    keys: ['x'],
    title: 'delete comment',
    hint: 'delete',
    run: (app) => {
      const comment = selectedComment(app);
      if (comment) app.actions.deleteComment(comment);
    },
  },
];

/** Commands live right now, most specific first. */
export function activeCommands(app: App): Command[] {
  const scopes: Scope[] =
    app.focus === 'diff'
      ? ['diff', 'global']
      : [app.sidebar.tab, 'list', 'global'];
  return scopes.flatMap((scope) =>
    COMMANDS.filter(
      (command) => command.scope === scope && (command.when?.(app) ?? true),
    ),
  );
}

export function findCommand(app: App, key: string): Command | undefined {
  return activeCommands(app).find((command) => command.keys.includes(key));
}
