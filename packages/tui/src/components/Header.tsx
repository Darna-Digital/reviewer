import { describeComparison } from '../app/comparison';
import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

/** Repo, branch and the comparison chip on the left; totals on the right. */
export function Header() {
  const { palette, screen, review, diff, actions } = useAppContext();
  const { repo, status, files, comparison } = review;
  const bg = palette.frame;
  const branch =
    repo?.branch ?? (repo ? `detached ${repo.head.slice(0, 7)}` : '…');
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const comments = review.visibleComments.length;
  const isAimed =
    comparison.kind === 'branch' && comparison.against === review.aim;

  const divergence: Seg[] = [];
  if (status?.ahead)
    divergence.push({ text: ` ↑${status.ahead}`, fg: palette.added, bg });
  if (status?.behind)
    divergence.push({ text: ` ↓${status.behind}`, fg: palette.warning, bg });

  const totals: Seg[] = [
    ...(review.loading ? [{ text: '◌ loading  ', fg: palette.faint, bg }] : []),
    {
      text: `${files.length} ${files.length === 1 ? 'file' : 'files'}  `,
      fg: palette.muted,
      bg,
    },
    {
      text: `+${additions}`,
      fg: additions ? palette.added : palette.faint,
      bg,
      bold: additions > 0,
    },
    { text: ' ', bg },
    {
      text: `−${deletions}`,
      fg: deletions ? palette.deleted : palette.faint,
      bg,
      bold: deletions > 0,
    },
    ...(comments ? [{ text: `  ◆ ${comments}`, fg: palette.accent, bg }] : []),
    { text: '  ', bg },
  ];
  const chipBg = mix(bg, palette.accent, 0.18);
  const brand: Seg[] = [
    { text: ' ◆ ', fg: palette.accent, bg, bold: true },
    { text: 'reviewer  ', fg: palette.text, bg, bold: true },
    { text: `${repo?.name ?? '…'}  `, fg: palette.muted, bg },
  ];

  return (
    <box
      flexDirection="row"
      height={1}
      width={screen.width}
      backgroundColor={bg}
    >
      <Line segs={brand} width={segsWidth(brand)} fill={bg} />
      <Button
        segs={[
          { text: '⎇ ', fg: palette.faint, bg },
          { text: branch, fg: palette.added, bg, bold: true },
          ...divergence,
        ]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.focusSidebar('branches')}
      />
      <Line segs={[{ text: '   ', bg }]} width={3} fill={bg} />
      <Button
        segs={[
          {
            text: ` ⇄ ${describeComparison(comparison)}${isAimed ? ' ◎' : ''} `,
            fg: palette.accent,
            bg: chipBg,
            bold: true,
          },
          { text: '▾ ', fg: palette.accent, bg: chipBg },
        ]}
        bg={chipBg}
        hoverTint={palette.accent}
        onPress={() => actions.openOverlay({ kind: 'targets' })}
      />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <Button
        segs={totals}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.openOverlay({ kind: 'files' })}
      />
      <Button
        segs={[
          {
            text: diff.view === 'split' ? ' ◫ ' : ' ▤ ',
            fg: palette.muted,
            bg,
          },
        ]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() =>
          diff.setView((view) => (view === 'unified' ? 'split' : 'unified'))
        }
      />
      <Button
        segs={[{ text: ' ? ', fg: palette.faint, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.openOverlay({ kind: 'help' })}
      />
    </box>
  );
}
