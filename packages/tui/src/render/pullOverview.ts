import type { PullRequestInfo } from '../github/client';
import {
  blockedReason,
  checksHeadline,
  checksState,
  checksTally,
  sortedChecks,
} from '../github/pullStatus';
import type { CheckState } from '../github/pullStatus';
import { ago, agoLong } from '../text/time';
import { wrapProse } from '../text/measure';
import { bar, heading, rowBg } from './listItems';
import type { ListItem } from './listItems';
import { mix } from './palette';
import type { Palette } from './palette';
import { fitSegs, spread } from './styled';
import type { Seg } from './styled';

const CHECK_GLYPH: Record<CheckState, string> = {
  success: '✓',
  failure: '✗',
  pending: '◌',
  neutral: '○',
};

const CHECK_WORD: Record<CheckState, string> = {
  success: 'passed',
  failure: 'failed',
  pending: 'running',
  neutral: 'skipped',
};

export function checkGlyph(state: CheckState): string {
  return CHECK_GLYPH[state];
}

export function checkColor(palette: Palette, state: CheckState): string {
  switch (state) {
    case 'success':
      return palette.added;
    case 'failure':
      return palette.deleted;
    case 'pending':
      return palette.warning;
    case 'neutral':
      return palette.faint;
  }
}

/** The list row's right side: blocked, CI verdict, last update. */
export function pullBadges(
  palette: Palette,
  pull: PullRequestInfo,
  now: number,
): Seg[] {
  const state = checksState(pull);
  return [
    ...(pull.mergeable === 'conflicting'
      ? [{ text: '⚠ ', fg: palette.warning }]
      : []),
    ...(state
      ? [{ text: `${checkGlyph(state)} `, fg: checkColor(palette, state) }]
      : []),
    { text: ago(pull.updatedAt, now), fg: palette.faint },
  ];
}

/**
 * The pull request on screen, line by line, for the Pull request pane: what
 * the Mac app's overview and inspector show, top to bottom.
 */
export function pullOverviewLines(
  palette: Palette,
  pull: PullRequestInfo,
  width: number,
  now: number,
): Seg[][] {
  const lines: Seg[][] = [];
  const blank = () => lines.push([]);
  const section = (text: string) =>
    lines.push([{ text, fg: palette.muted, bold: true }]);

  lines.push([
    { text: pull.title, fg: palette.text, bold: true },
    { text: `  #${pull.number}`, fg: palette.faint },
    ...(pull.draft ? [{ text: '  Draft', fg: palette.warning }] : []),
  ]);
  lines.push([
    { text: pull.author, fg: palette.text },
    {
      text: ` opened ${agoLong(pull.createdAt, now)} · updated ${agoLong(pull.updatedAt, now)}`,
      fg: palette.faint,
    },
  ]);
  lines.push([
    { text: pull.headRef, fg: palette.accent },
    { text: ' → ', fg: palette.faint },
    { text: pull.baseRef, fg: palette.accent },
    ...(pull.fromFork ? [{ text: '  from a fork', fg: palette.faint }] : []),
    { text: '   ', fg: palette.faint },
    { text: `+${pull.additions}`, fg: palette.added },
    { text: ` −${pull.deletions}`, fg: palette.deleted },
    {
      text: ` · ${pull.changedFiles} file${pull.changedFiles === 1 ? '' : 's'}`,
      fg: palette.faint,
    },
  ]);

  const blocked = blockedReason(pull);
  if (blocked) {
    blank();
    for (const row of wrapProse(`⚠ ${blocked}`, width))
      lines.push([{ text: row, fg: palette.warning }]);
  }

  blank();
  const state = checksState(pull);
  if (state) {
    lines.push([
      { text: `${checkGlyph(state)} `, fg: checkColor(palette, state) },
      { text: checksHeadline(pull) ?? '', fg: palette.text, bold: true },
      { text: `  ${checksTally(pull) ?? ''}`, fg: palette.faint },
    ]);
    for (const check of sortedChecks(pull)) {
      lines.push([
        {
          text: `  ${checkGlyph(check.state)} `,
          fg: checkColor(palette, check.state),
        },
        { text: check.name, fg: palette.text },
        { text: `  ${CHECK_WORD[check.state]}`, fg: palette.faint },
      ]);
    }
  } else {
    lines.push([{ text: 'No checks reported', fg: palette.faint }]);
  }

  blank();
  const people = (label: string, names: readonly string[]) =>
    lines.push([
      { text: `${label}  `, fg: palette.muted },
      {
        text: names.length > 0 ? names.join(', ') : 'None',
        fg: names.length > 0 ? palette.text : palette.faint,
      },
    ]);
  people('Reviewers', pull.reviewers);
  people('Assignees', pull.assignees);
  if (pull.labels.length > 0) {
    lines.push([
      { text: 'Labels  ', fg: palette.muted },
      ...pull.labels.flatMap((label) => [
        {
          text: ` ${label.name} `,
          fg: palette.accentInk,
          bg: `#${label.color}`,
        },
        { text: ' ' },
      ]),
    ]);
  }

  blank();
  section('Description');
  const body = pull.body.trim();
  if (!body) {
    lines.push([{ text: 'No description provided.', fg: palette.faint }]);
  } else {
    for (const row of wrapProse(body, width))
      lines.push([{ text: row, fg: palette.text }]);
  }
  return lines;
}

/**
 * The sidebar's pull requests, under a heading per target branch: number and
 * title over author and branch, with the blocked and CI marks and age right.
 */
export function pullItems(
  palette: Palette,
  groups: Array<{ base: string; pulls: PullRequestInfo[] }>,
  shown: number | null,
  now: number,
): Array<ListItem<PullRequestInfo>> {
  return groups.flatMap(({ base, pulls }) => [
    heading<PullRequestInfo>(
      palette,
      `base:${base}`,
      base || 'No branch',
      pulls.length > 1 ? String(pulls.length) : undefined,
    ),
    ...pulls.map((pull): ListItem<PullRequestInfo> => ({
      key: String(pull.number),
      selectable: true,
      height: 2,
      value: pull,
      rows: (look) => {
        const bg = rowBg(palette, look);
        const lit = look.selected || pull.number === shown;
        const title: Seg[] = [
          bar(palette, look, bg),
          { text: ' ', bg },
          ...(pull.draft ? [{ text: '✎ ', fg: palette.faint, bg }] : []),
          {
            text: pull.title,
            fg: lit ? palette.text : mix(palette.frame, palette.text, 0.85),
            bold: pull.number === shown,
            bg,
          },
        ];
        const badges = pullBadges(palette, pull, now).map((seg) => ({
          ...seg,
          bg,
        }));
        return [
          spread(title, [...badges, { text: ' ', bg }], look.width, bg),
          fitSegs(
            [
              bar(palette, look, bg),
              { text: ` #${pull.number}`, fg: palette.muted, bg },
              {
                text: ` ${pull.author} · ${pull.headRef}`,
                fg: palette.faint,
                bg,
              },
            ],
            look.width,
            bg,
          ),
        ];
      },
    })),
  ]);
}
