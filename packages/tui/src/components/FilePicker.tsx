import { STATUS_LETTER, statusColor } from '../render/diffRows';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

export function FilePicker() {
  const app = useAppContext();
  const { palette, review, diff, actions } = app;
  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title="Go to file"
      placeholder="Search changed files…"
      options={review.files.map((file) => ({
        key: file.path,
        label: file.path,
        hint: `${STATUS_LETTER[file.status]}  +${file.additions} −${file.deletions}`,
        hintColor: statusColor(palette, file.status),
      }))}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        actions.closeOverlay();
        diff.jumpToFile(
          review.files.findIndex((file) => file.path === option.key),
        );
        app.setFocus('diff');
      }}
    />
  );
}
