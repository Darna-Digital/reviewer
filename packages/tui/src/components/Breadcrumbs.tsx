import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { truncate } from '../text/measure';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

interface Crumb {
  segs: Seg[];
  onPress?: () => void;
}

/**
 * The trail under a commit opened from history, as the Mac app draws it:
 * Browse › History › file › commit. Browse and History lead back.
 */
export function Breadcrumbs() {
  const app = useAppContext();
  const { palette, layout, review, history, actions } = app;
  const bg = mix(palette.island, palette.text, 0.04);
  const width = layout.mainWidth;
  if (review.comparison.kind !== 'commit') return null;
  const sha = review.comparison.sha;
  const subject = review.commit?.subject;
  const file = history.path?.split('/').at(-1);

  const crumbs: Crumb[] = [
    {
      segs: [{ text: ' ≡ Browse ', fg: palette.muted, bg }],
      onPress: () => actions.setSurface('browse'),
    },
    {
      segs: [{ text: ' ◷ History ', fg: palette.muted, bg }],
      onPress: () => actions.showHistoryFor(history.path),
    },
    ...(file ? [{ segs: [{ text: ` ${file} `, fg: palette.muted, bg }] }] : []),
  ];
  const back: Seg[] = [
    { text: ' esc', fg: palette.muted, bg, bold: true },
    { text: ' back ', fg: palette.faint, bg },
  ];
  const used =
    crumbs.reduce((sum, crumb) => sum + segsWidth(crumb.segs) + 1, 1) +
    segsWidth(back);
  const commit: Seg[] = [
    { text: ' ', bg },
    { text: sha.slice(0, 7), fg: palette.warning, bg },
    {
      text: ` ${truncate(subject ?? 'Commit', Math.max(8, width - used - 10))}`,
      fg: palette.text,
      bg,
      bold: true,
    },
  ];

  return (
    <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
      <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
      {crumbs.map((crumb, i) => (
        <box key={i} flexDirection="row" height={1}>
          {crumb.onPress ? (
            <Button
              segs={crumb.segs}
              bg={bg}
              hoverTint={palette.text}
              onPress={crumb.onPress}
            />
          ) : (
            <Line segs={crumb.segs} width={segsWidth(crumb.segs)} fill={bg} />
          )}
          <Line segs={[{ text: '›', fg: palette.faint }]} width={1} fill={bg} />
        </box>
      ))}
      <Line segs={commit} width={segsWidth(commit)} fill={bg} />
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <Button
        segs={back}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.back()}
      />
    </box>
  );
}
