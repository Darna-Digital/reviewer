import { pullHaystack } from '../github/pullStatus';
import { pullBadges } from '../render/pullOverview';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

const FOOTER = ' ⏎ review · ^x check out · ^g open on GitHub · ^r reload ';

/** Open pull requests by target branch, as the Mac app's Merge requests list. */
export function PullsPicker() {
  const app = useAppContext();
  const { pulls, actions, palette, now } = app;
  const sorted = pulls.groups.flatMap((group) => group.pulls);
  const shown = pulls.shown?.key;

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title="Pull requests"
      placeholder="Search by number, title, author or branch…"
      width={96}
      labelCut="end"
      initialKey={shown}
      emptyText={
        pulls.error ??
        (pulls.loading || !pulls.loaded ? 'Loading…' : 'No open pull requests')
      }
      options={sorted.map((pull) => {
        const badges = pullBadges(palette, pull, now);
        return {
          key: pull.key,
          group: app.review.repos.spans
            ? `${pull.repo.name} › ${pull.baseRef || 'No branch'}`
            : pull.baseRef || 'No branch',
          label: `#${pull.number}  ${pull.title}`,
          search: pullHaystack(pull),
          labelColor: pull.draft ? palette.muted : undefined,
          detail: `${pull.author} · ${pull.headRef}${pull.draft ? ' · draft' : ''}`,
          hint: badges.map((seg) => seg.text).join(''),
          hintColor: badges.at(-2)?.fg ?? palette.faint,
        };
      })}
      footer={[{ text: FOOTER, fg: palette.faint }]}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        const pull = pulls.byKey(option.key);
        if (pull) actions.reviewPull(pull);
      }}
      onKey={(key, option) => {
        const pull = option ? pulls.byKey(option.key) : null;
        if (key === 'ctrl+r') void pulls.reload();
        else if (key === 'ctrl+x' && pull) {
          actions.closeOverlay();
          void pulls.checkout(pull);
        } else if (key === 'ctrl+g' && pull) actions.openUrl(pull.url);
        else return false;
        return true;
      }}
    />
  );
}
