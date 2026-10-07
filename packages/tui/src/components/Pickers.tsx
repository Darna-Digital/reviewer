import { describeThemes } from '@reviewer/core/themes';
import { describeTarget } from '../app/comparison';
import { TERMINAL_THEME } from '../store/settings';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

const APPEARANCE_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

/** Theme and appearance, as the Mac app's settings; moving previews live. */
export function ThemePicker() {
  const app = useAppContext();
  const { palette, themes, actions, review } = app;
  const { settings } = themes;
  const chosen = (name: string) =>
    [
      settings.lightTheme === name ? 'light' : '',
      settings.darkTheme === name ? 'dark' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const options = [
    {
      key: TERMINAL_THEME,
      label: 'Terminal — its own background and colours',
      group: 'Terminal',
      hint: chosen(TERMINAL_THEME),
      hintColor: palette.accent,
    },
    ...(['light', 'dark'] as const).flatMap((scheme) =>
      describeThemes()
        .filter((theme) => theme.colorScheme === scheme)
        .map((theme) => ({
          key: theme.name,
          label: theme.displayName,
          group: scheme === 'light' ? 'Light themes' : 'Dark themes',
          hint: chosen(theme.name),
          hintColor: palette.accent,
        })),
    ),
  ];
  const appearance = (['system', 'light', 'dark'] as const).flatMap((mode) => {
    const on = settings.appearance === mode;
    return [
      {
        text: ` ${APPEARANCE_LABEL[mode]} `,
        fg: on ? palette.accentInk : palette.muted,
        bg: on ? palette.accent : palette.popover,
        bold: on,
      },
      { text: ' ' },
    ];
  });
  const close = () => {
    themes.preview(null);
    actions.closeOverlay();
  };
  const cycle = () => themes.cycleAppearance();

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title="Theme"
      placeholder="Search themes…"
      options={options}
      initialKey={themes.look.name}
      onHighlight={(option) => themes.preview(option.key)}
      footer={[
        { text: ' Appearance  ', fg: palette.faint },
        ...appearance,
        {
          text: ` tab · now ${themes.scheme}`,
          fg: palette.faint,
        },
      ]}
      onFooterPress={cycle}
      onKey={(key) => {
        if (key !== 'tab') return false;
        cycle();
        return true;
      }}
      onClose={close}
      onPick={(option) => {
        const scheme = themes.choose(option.key);
        actions.closeOverlay();
        if (scheme !== 'both' && scheme !== themes.scheme)
          review.notify(
            'info',
            `${option.label} is your ${scheme} theme — it shows when the appearance is ${scheme}`,
          );
      }}
    />
  );
}

/** Every comment in the repository, grouped by the change it was left on. */
export function CommentsPicker() {
  const app = useAppContext();
  const { review, actions, now } = app;
  return (
    <Picker
      palette={app.palette}
      screen={app.screen}
      title="Comments"
      placeholder="Search comments…"
      emptyText="No comments yet — press c on a line"
      options={review.comments.map((comment) => ({
        key: comment.id,
        label: `${comment.filePath}:${comment.lineNumber}  ${comment.body.split('\n')[0] ?? ''}`,
        group: describeTarget(comment.target),
        hint: `${comment.author.split(' ')[0] ?? ''} · ${ago(comment.createdAt, now)}`,
      }))}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        actions.closeOverlay();
        const comment = review.comments.find((c) => c.id === option.key);
        if (comment) actions.openComment(comment);
      }}
    />
  );
}
