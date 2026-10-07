import type { ReviewComment } from '@reviewer/core/comments';
import * as React from 'react';
import type { Theme } from '../diff/highlight';
import type { FileDiff } from '../diff/parseDiff';
import { readFile } from '../git/files';
import type { FileContent } from '../git/files';
import type { Palette } from '../render/palette';
import { printable } from '../text/measure';
import { useDiffView } from './useDiffView';
import type { Review } from './useReview';

export interface EditorTab {
  path: string;
  /** A single-click preview reuses one slot until it is kept. */
  preview: boolean;
}

export type Editor = ReturnType<typeof useEditor>;

interface EditorOptions {
  review: Review;
  width: number;
  height: number;
  palette: Palette;
  theme: Theme;
  themeName: string;
  focused: boolean;
  now: number;
}

/** Open-file tabs and the viewer for the active one, with its comments. */
export function useEditor(opts: EditorOptions) {
  const { review } = opts;
  const [tabs, setTabs] = React.useState<EditorTab[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<{
    path: string;
    file: FileContent;
  } | null>(null);

  // re-read the open file whenever the repository was re-read
  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void readFile(review.root, active).then((file) => {
      if (!cancelled) setContent({ path: active, file });
    });
    return () => {
      cancelled = true;
    };
  }, [active, review.root, review.statusMap]);

  const files = React.useMemo(
    () =>
      content && content.path === active
        ? [fileAsDiff(content.path, content.file)]
        : [],
    [content, active],
  );
  const comments = React.useMemo(
    (): ReviewComment[] =>
      review.comments.filter(
        (comment) =>
          comment.target === 'worktree' && comment.filePath === active,
      ),
    [review.comments, active],
  );
  const viewer = useDiffView({ ...opts, files, comments, fixedView: 'file' });

  return {
    tabs,
    active,
    viewer,
    loading: active !== null && content?.path !== active,
    /** Opens `path`; a preview replaces the current preview tab. */
    open(path: string, { preview = false }: { preview?: boolean } = {}) {
      setTabs((list) => {
        const existing = list.find((tab) => tab.path === path);
        if (existing) {
          return preview
            ? list
            : list.map((tab) =>
                tab.path === path ? { ...tab, preview: false } : tab,
              );
        }
        const kept = preview ? list.filter((tab) => !tab.preview) : list;
        return [...kept, { path, preview }];
      });
      setActive(path);
    },
    close(path: string) {
      setTabs((list) => {
        const index = list.findIndex((tab) => tab.path === path);
        const next = list.filter((tab) => tab.path !== path);
        if (path === active)
          setActive(next[Math.min(index, next.length - 1)]?.path ?? null);
        return next;
      });
    },
    activate: setActive,
    step(delta: number) {
      if (tabs.length === 0) return;
      const index = tabs.findIndex((tab) => tab.path === active);
      setActive(tabs[(index + delta + tabs.length) % tabs.length]!.path);
    },
  };
}

/** A file as a one-hunk "diff" of context lines, so the viewer reuses the diff view. */
export function fileAsDiff(path: string, file: FileContent): FileDiff {
  const base: FileDiff = {
    path,
    oldPath: null,
    status: 'modified',
    binary: file.binary,
    hunks: [],
    additions: 0,
    deletions: 0,
  };
  if (file.skipped) return { ...base, skipped: file.skipped };
  if (file.binary) return base;
  if (file.text.length === 0) return { ...base, skipped: 'Empty file' };
  const lines = file.text
    .replace(/\n$/, '')
    .split('\n')
    .map((text, i) => ({
      kind: 'context' as const,
      text: printable(text),
      oldNo: i + 1,
      newNo: i + 1,
    }));
  return { ...base, hunks: [{ oldStart: 1, newStart: 1, section: '', lines }] };
}
