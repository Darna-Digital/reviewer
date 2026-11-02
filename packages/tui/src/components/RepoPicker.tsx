import type { Overlay } from '../app/useApp';
import { branchLabel } from '../render/repoLabels';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

type ReposOverlay = Extract<Overlay, { kind: 'repos' }>;

const WIDTH = 64;

/**
 * A workspace's repositories, each with its branch and changes: ⏎ focuses
 * one — the branch chip, history and git actions are then about it — and,
 * opened from the branch chip, goes on to its branches.
 */
export function RepoPicker({ overlay }: { overlay: ReposOverlay }) {
  const app = useAppContext();
  const { palette, review, actions } = app;
  const { repos, focused } = review;
  const options = repos.list.map((repo) => {
    const state = review.stateOf(repo);
    const changes = [...review.statusMap.keys()].filter((path) =>
      path.startsWith(`${repo.name}/`),
    ).length;
    return {
      key: repo.root,
      label: repo.name,
      group: repos.workspace?.name ?? 'Repositories',
      hint: [
        repo === focused ? '● focused' : '',
        state ? branchLabel(state) : '',
        changes ? `±${changes}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      hintColor: repo === focused ? palette.accent : undefined,
      labelColor: repo === focused ? palette.text : undefined,
    };
  });
  const goesOn = overlay.then === 'branches';

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      anchor={overlay.at}
      width={WIDTH}
      title={goesOn ? 'Branches — which repository?' : 'Focus a repository'}
      labelCut="middle"
      placeholder="Search repositories…"
      options={options}
      initialKey={focused.root}
      footer={[
        { text: ' ⌘O', fg: palette.accent },
        { text: ' workspaces…', fg: palette.muted },
        ...(goesOn
          ? [
              { text: '   ⇥', fg: palette.muted },
              { text: ' focus only', fg: palette.faint },
            ]
          : []),
      ]}
      onFooterPress={actions.openWorkspaces}
      onClose={actions.closeOverlay}
      onKey={(key, picked) => {
        if (key === 'cmd+o' || key === 'O') actions.openWorkspaces();
        else if (key === 'tab' && picked) focus(picked.key, false);
        else return false;
        return true;
      }}
      onPick={(picked) => focus(picked.key, goesOn)}
    />
  );

  function focus(root: string, thenBranches: boolean) {
    const repo = repos.list.find((candidate) => candidate.root === root);
    if (!repo) return;
    actions.focusRepo(repo);
    if (thenBranches) actions.openBranches(overlay.at, { pickRepo: false });
    else actions.closeOverlay();
  }
}
