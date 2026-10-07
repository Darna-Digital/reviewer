import type { Surface } from '../app/useWorkspace';
import { mix } from '../render/palette';
import { segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

const SURFACES: Array<{ surface: Surface; label: string }> = [
  { surface: 'browse', label: ' ≡ Browse ' },
  { surface: 'review', label: ' ± Review ' },
];

/** Project, the Browse/Review switch, and the git round-trip buttons. */
export function TopRail() {
  const { palette, screen, review, workspace, actions } = useAppContext();
  const bg = palette.frame;
  const ahead = review.status?.ahead ?? 0;
  const behind = review.status?.behind ?? 0;
  const brand: Seg[] = [
    { text: ' ◆ ', fg: palette.accent, bg, bold: true },
    { text: 'reviewer ', fg: palette.text, bg, bold: true },
    { text: '│ ', fg: palette.rule, bg },
  ];
  const chip = mix(bg, palette.text, 0.08);

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
          { text: ' ▣ ', fg: palette.accent, bg: chip },
          {
            text: `${review.repo?.name ?? '…'} `,
            fg: palette.text,
            bg: chip,
            bold: true,
          },
        ]}
        bg={chip}
        hoverTint={palette.text}
        onPress={() => actions.copy(review.root)}
      />
      <Line segs={[{ text: '   ' }]} width={3} fill={bg} />
      {SURFACES.map(({ surface, label }) => {
        const on = workspace.surface === surface;
        const tabBg = on ? palette.selection : bg;
        return (
          <Button
            key={surface}
            segs={[
              {
                text: label,
                fg: on ? palette.text : palette.muted,
                bg: tabBg,
                bold: on,
              },
            ]}
            bg={tabBg}
            hoverTint={palette.text}
            onPress={() => actions.setSurface(surface)}
          />
        );
      })}
      <box flexGrow={1} height={1} backgroundColor={bg} />
      <Button
        segs={[{ text: ' ⟳ Fetch ', fg: palette.muted, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => void actions.fetch()}
      />
      <Button
        segs={[
          {
            text: ` ↓ Pull${behind ? ` ${behind}` : ''} `,
            fg: behind ? palette.warning : palette.muted,
            bg,
          },
        ]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => void actions.pull()}
      />
      <Button
        segs={[
          {
            text: ` ↑ Push${ahead ? ` ${ahead}` : ''} `,
            fg: ahead ? palette.added : palette.muted,
            bg,
            bold: ahead > 0,
          },
        ]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => void actions.push()}
      />
      <Line segs={[{ text: ' │ ', fg: palette.rule }]} width={3} fill={bg} />
      <Button
        segs={[{ text: ' ⌘ Commands ', fg: palette.muted, bg }]}
        bg={bg}
        hoverTint={palette.text}
        onPress={() => actions.openOverlay({ kind: 'palette' })}
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
