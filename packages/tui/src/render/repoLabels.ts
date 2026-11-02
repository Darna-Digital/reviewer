import type { RepoState } from '../app/useReview';

/** `⎇ main ↑2 ↓1`: a repository's branch and how far it is from its upstream. */
export function branchLabel(state: RepoState): string {
  const { ahead, behind } = state.status;
  return [
    `⎇ ${state.info.branch ?? 'detached'}`,
    ahead ? `↑${ahead}` : '',
    behind ? `↓${behind}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
