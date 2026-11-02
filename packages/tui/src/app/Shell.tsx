import * as React from 'react';
import { stopAllSessions } from '../process/ptySession';
import { reposOf } from '../repos/repos';
import type { Repos } from '../repos/repos';
import { saveLastWorkspace } from '../store/uiState';
import { App } from './App';
import { WORKTREE } from './comparison';
import type { AppProps } from './useApp';

export interface ShellProps extends Omit<AppProps, 'repos' | 'openRepos'> {
  repos: Repos;
  /** The repository the TUI was started in, which remembers the workspace it opened. */
  launchRoot: string | null;
}

/** Holds what is open, and opens another workspace in place of it. */
export function Shell({ repos: first, launchRoot, ...props }: ShellProps) {
  const { store } = props;
  const [repos, setRepos] = React.useState(first);
  const opened = repos !== first;

  // after the commit, so the App that is going cannot save its layout over this
  React.useEffect(() => {
    if (launchRoot)
      saveLastWorkspace(store, launchRoot, repos.workspace?.id ?? null);
  }, [store, repos, launchRoot]);

  const openRepos = React.useCallback(
    (roots: string[], workspace: Repos['workspace']) => {
      stopAllSessions();
      setRepos(reposOf(roots, workspace));
    },
    [],
  );

  return (
    <App
      key={repos.list.map((repo) => repo.root).join('\0')}
      {...props}
      initial={opened ? WORKTREE : props.initial}
      focus={opened ? undefined : props.focus}
      repos={repos}
      openRepos={openRepos}
    />
  );
}
