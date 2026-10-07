import type { CommitDetail } from '../git/log';
import { cellWidth, truncate, wrapProse } from '../text/measure';
import { agoLong } from '../text/time';
import type { Palette } from './palette';
import { fitSegs, spread } from './styled';
import type { Seg } from './styled';

const MAX_BODY_LINES = 4;

/** The rows above a commit's diff: subject, author and message. */
export function commitBanner(
  palette: Palette,
  commit: CommitDetail,
  width: number,
  now: number,
): Seg[][] {
  const bg = palette.control;
  const meta = `${commit.author} · ${agoLong(commit.date, now)} `;
  const subjectRoom = width - 14 - cellWidth(meta);
  const rows: Seg[][] = [
    spread(
      [
        { text: ' ● ', fg: palette.accent, bg, bold: true },
        { text: commit.shortSha, fg: palette.warning, bg },
        { text: '  ', bg },
        {
          text: truncate(commit.subject, Math.max(10, subjectRoom)),
          fg: palette.text,
          bg,
          bold: true,
        },
      ],
      [{ text: meta, fg: palette.faint, bg }],
      width,
      bg,
    ),
  ];
  for (const line of wrapProse(commit.body, width - 8).slice(
    0,
    MAX_BODY_LINES,
  )) {
    rows.push(
      fitSegs([{ text: `      ${line}`, fg: palette.muted, bg }], width, bg),
    );
  }
  return rows;
}
