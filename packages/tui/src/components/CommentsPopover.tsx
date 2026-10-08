import type { ReviewComment } from '@reviewer/core/comments';
import type { Overlay } from '../app/useApp';
import type { FileDiff } from '../diff/parseDiff';
import type { Seg } from '../render/styled';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

type CommentsOverlay = Extract<Overlay, { kind: 'commentsHere' }>;

export const COMMENTS_POPOVER_WIDTH = 72;

/**
 * The comments on the change being reviewed, under the header's comments
 * button: grouped by file, each with its line of code; picking one jumps to
 * it. The footer shows or hides them in the diff.
 */
export function CommentsPopover({ overlay }: { overlay: CommentsOverlay }) {
  const app = useAppContext();
  const { palette, review, diff, actions, now } = app;
  const comments = [...review.visibleComments].sort(
    (a, b) =>
      a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber,
  );
  const footer: Seg[] = [
    {
      text: diff.showComments ? ' [✓] ' : ' [ ] ',
      fg: diff.showComments ? palette.accent : palette.muted,
      bold: true,
    },
    { text: 'show in the diff', fg: palette.muted },
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
      emptyText="No comments on this change — press c on a line"
      options={comments.map((comment) => ({
        key: comment.id,
        label: `${comment.lineNumber}${comment.side === 'deletions' ? ' (old)' : ''}  ${firstLine(comment.body)}`,
        group: comment.filePath,
        hint: `${comment.author.split(' ')[0] ?? ''} · ${ago(comment.createdAt, now)}`,
        detail: codeAt(review.files, comment) ?? '(line no longer in the diff)',
      }))}
      footer={footer}
      onFooterPress={() => diff.setShowComments((on) => !on)}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        const comment = comments.find((c) => c.id === picked.key);
        if (comment) actions.openComment(comment);
      }}
    />
  );
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}

/** The code a comment was left on, as the diff shows it now. */
function codeAt(files: FileDiff[], comment: ReviewComment): string | null {
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
