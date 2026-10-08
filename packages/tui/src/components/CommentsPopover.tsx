import type { ReviewComment } from '@reviewer/core/comments';
import type { App, Overlay } from '../app/useApp';
import { useFileLines } from '../app/useFileLines';
import type { FileDiff } from '../diff/parseDiff';
import type { Seg } from '../render/styled';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

type CommentsOverlay = Extract<Overlay, { kind: 'commentsHere' }>;

export const COMMENTS_POPOVER_WIDTH = 72;

/**
 * Comments by file, each with its line of code: the change under review
 * first, then the rest of the codebase (notes left while browsing). Picking
 * one jumps to it — in the diff, or in the file when it is not in the diff.
 * The footer shows or hides them inline.
 */
export function CommentsPopover({ overlay }: { overlay: CommentsOverlay }) {
  const app = useAppContext();
  const { palette, review, actions, activeView, now } = app;
  const comments = commentsToList(app);
  const inDiff = new Set(review.files.map((file) => file.path));
  const fileLines = useFileLines(
    review.root,
    [...new Set(comments.map((c) => c.filePath))].filter(
      (path) => !inDiff.has(path),
    ),
  );
  const footer: Seg[] = [
    {
      text: activeView.showComments ? ' [✓] ' : ' [ ] ',
      fg: activeView.showComments ? palette.accent : palette.muted,
      bold: true,
    },
    { text: 'show inline', fg: palette.muted },
    { text: '   C', fg: palette.faint },
  ];

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      anchor={overlay.at}
      width={COMMENTS_POPOVER_WIDTH}
      pathGroups
      title={`Comments · ${comments.length}`}
      placeholder="Search comments…"
      emptyText="No comments yet — press c on a line"
      options={comments.map((comment) => ({
        key: comment.id,
        label: `${comment.lineNumber}${comment.side === 'deletions' ? ' (old)' : ''}  ${firstLine(comment.body)}`,
        group: comment.filePath,
        hint: `${comment.author.split(' ')[0] ?? ''} · ${ago(comment.createdAt, now)}`,
        detail:
          codeInDiff(review.files, comment) ??
          codeInFile(fileLines.get(comment.filePath), comment) ??
          '(line not found)',
      }))}
      footer={footer}
      onFooterPress={() => activeView.setShowComments((on) => !on)}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        const comment = comments.find((c) => c.id === picked.key);
        if (comment) actions.openComment(comment);
      }}
    />
  );
}

/** Comments the popover lists, in order; also the count its buttons show. */
export function commentsToList(app: App): ReviewComment[] {
  const { review, workspace } = app;
  const byPlace = (a: ReviewComment, b: ReviewComment) =>
    a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber;
  const change =
    workspace.surface === 'review' ? [...review.visibleComments] : [];
  const listed = new Set(change.map((comment) => comment.id));
  const codebase = review.comments.filter(
    (comment) => comment.target === 'worktree' && !listed.has(comment.id),
  );
  return [...change.sort(byPlace), ...codebase.sort(byPlace)];
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}

/** The code a comment was left on, as the diff shows it now. */
function codeInDiff(files: FileDiff[], comment: ReviewComment): string | null {
  const file = files.find((candidate) => candidate.path === comment.filePath);
  for (const hunk of file?.hunks ?? []) {
    for (const line of hunk.lines) {
      const number = comment.side === 'deletions' ? line.oldNo : line.newNo;
      const onSide =
        comment.side === 'deletions'
          ? line.kind !== 'add'
          : line.kind !== 'del';
      if (onSide && number === comment.lineNumber) return line.text.trim();
    }
  }
  return null;
}

/** The line in the working-tree file, for notes on files outside the diff. */
function codeInFile(
  lines: string[] | undefined,
  comment: ReviewComment,
): string | null {
  if (!lines || comment.side === 'deletions') return null;
  return lines[comment.lineNumber - 1]?.trim() ?? null;
}
