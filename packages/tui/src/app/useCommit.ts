import type { TextareaRenderable } from '@opentui/core';
import * as React from 'react';
import { commit, push, summarize } from '../git/actions';
import { draftCommitMessage } from '../git/commitMessage';
import type { Review } from './useReview';
import type { Workspace } from './useWorkspace';

export type Commit = ReturnType<typeof useCommit>;

/**
 * The commit composer: which changed files go in (all, until unticked), the
 * message (kept per repository across launches), and drafting it with Claude.
 */
export function useCommit(review: Review, workspace: Workspace) {
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [busy, setBusy] = React.useState<'generating' | 'committing' | null>(
    null,
  );
  const textarea = React.useRef<TextareaRenderable | null>(null);

  const paths =
    review.comparison.kind === 'worktree'
      ? review.files.map((file) => file.path)
      : [];
  const included = paths.filter((path) => !excluded.has(path));
  const message = workspace.commitMessage;
  const canCommit = !busy && included.length > 0 && message.trim().length > 0;

  function setMessage(text: string) {
    workspace.setCommitMessage(text);
    if (textarea.current && textarea.current.plainText !== text)
      textarea.current.setText(text);
  }

  return {
    textarea,
    paths,
    included,
    message,
    busy,
    canCommit,
    isIncluded: (path: string) => !excluded.has(path),
    /** Ticks or unticks `files` together — a folder toggles everything under it. */
    toggle(files: string[]) {
      setExcluded((set) => {
        const next = new Set(set);
        const allIn = files.every((path) => !set.has(path));
        for (const path of files) {
          if (allIn) next.add(path);
          else next.delete(path);
        }
        return next;
      });
    },
    toggleAll() {
      setExcluded(
        included.length === paths.length ? new Set(paths) : new Set(),
      );
    },
    onEdit() {
      workspace.setCommitMessage(textarea.current?.plainText ?? '');
    },
    async generate() {
      if (busy || included.length === 0) return;
      setBusy('generating');
      review.notify('info', 'Drafting a message with Claude…');
      try {
        setMessage(await draftCommitMessage(review.root, included));
        review.notify('success', 'Message drafted');
      } catch (error) {
        review.notify(
          'error',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setBusy(null);
      }
    },
    async commit({ andPush = false } = {}) {
      if (!canCommit) {
        review.notify(
          'info',
          included.length === 0
            ? 'Tick at least one file'
            : 'Write a commit message first',
        );
        return;
      }
      setBusy('committing');
      const files = included;
      const ok = await review.runGit(
        'Committing…',
        async () => {
          const sha = await commit(review.root, message.trim(), files);
          if (!andPush) return `Committed ${sha}`;
          try {
            await push(review.root);
            return `Committed ${sha} and pushed`;
          } catch {
            return `Committed ${sha}, but push failed`;
          }
        },
        (output) => summarize(output, output),
      );
      if (ok) {
        setMessage('');
        setExcluded(new Set());
      }
      setBusy(null);
    },
  };
}
