import * as React from 'react';
import { COMMANDS } from '../app/commands';
import { describeTarget } from '../app/comparison';
import { keyLabel } from '../app/keys';
import { grep } from '../git/files';
import type { GrepMatch } from '../git/files';
import { STATUS_LETTER } from '../render/listItems';
import { truncate } from '../text/measure';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

const SEARCH_DEBOUNCE_MS = 180;

/** Go to file: the whole project on Browse, the changed files on Review. */
export function FilePicker() {
  const app = useAppContext();
  const { palette, review, workspace, actions } = app;
  const isReview = workspace.surface === 'review';
  const options = isReview
    ? review.files.map((file) => ({
        key: file.path,
        label: file.path,
        hint: `${STATUS_LETTER[file.status]}  +${file.additions} −${file.deletions}`,
        hintColor: palette.gitStatus[file.status],
      }))
    : review.projectFiles.map((path) => {
        const status = review.statusMap.get(path);
        return {
          key: path,
          label: path,
          hint: status ? STATUS_LETTER[status] : '',
          hintColor: status ? palette.gitStatus[status] : undefined,
        };
      });
  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title={isReview ? 'Go to changed file' : 'Go to file'}
      placeholder="Search files by name…"
      options={options}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        actions.closeOverlay();
        if (isReview) actions.showInDiff(option.key);
        else actions.openFile(option.key);
        actions.setFocus('main');
      }}
    />
  );
}

/** Every command, by name — the ⌘K palette. */
export function CommandPalette() {
  const app = useAppContext();
  const options = COMMANDS.filter((command) => command.palette).map(
    (command) => ({
      key: command.id,
      label: capitalize(command.title),
      hint: command.keys[0] ? keyLabel(command.keys[0]) : '',
    }),
  );
  return (
    <Picker
      palette={app.palette}
      screen={app.screen}
      title="Commands"
      placeholder="Type a command…"
      options={options}
      onClose={app.actions.closeOverlay}
      onPick={(option) => {
        app.actions.closeOverlay();
        COMMANDS.find((command) => command.id === option.key)?.run(app);
      }}
    />
  );
}

/** `git grep` across the working tree; picking opens the file at the line. */
export function SearchPicker() {
  const app = useAppContext();
  const { palette, review, actions } = app;
  const [matches, setMatches] = React.useState<GrepMatch[]>([]);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void grep(review.root, query).then(
        (found) => !cancelled && setMatches(found),
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, review.root]);

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title="Search in files"
      placeholder="Search text…"
      filter={false}
      onQueryChange={setQuery}
      emptyText={
        query.trim().length < 2 ? 'Type at least two characters' : 'No matches'
      }
      options={matches.map((match) => ({
        key: `${match.path}:${match.line}`,
        label: `${match.path}:${match.line}`,
        hint: truncate(match.text, 40),
      }))}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        const match = matches.find((m) => `${m.path}:${m.line}` === option.key);
        actions.closeOverlay();
        if (!match) return;
        actions.openFile(match.path, { line: match.line });
        actions.setFocus('main');
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
