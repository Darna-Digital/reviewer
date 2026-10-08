import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';

const MESSAGE_ROWS = 4;
/** Below this width the buttons drop their words. */
const ROOMY = 34;

/** Message, Generate, Commit and Commit & push — below the changes tree. */
export function CommitBox({ height }: { height: number }) {
  const app = useAppContext();
  const { palette, layout, commit, actions } = app;
  const width = layout.sidebarWidth;
  const bg = palette.frame;
  const field = palette.control;
  const editing = app.typing === 'message';
  const count = `${commit.included.length} of ${commit.paths.length} files `;
  const roomy = width >= ROOMY;
  const ruleWidth = Math.max(0, width - count.length - 10);

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <Line
        segs={[
          { text: '─ ', fg: palette.rule },
          { text: 'COMMIT ', fg: palette.faint, bold: true },
          { text: '─'.repeat(ruleWidth), fg: palette.rule },
          { text: ` ${count}`, fg: palette.faint },
        ]}
        width={width}
        fill={bg}
      />
      <box
        height={MESSAGE_ROWS}
        width={width}
        flexDirection="row"
        backgroundColor={bg}
        onMouseDown={() => {
          actions.setFocus('sidebar');
          actions.setTyping('message');
        }}
      >
        <Line
          segs={[{ text: editing ? '▌' : ' ', fg: palette.accent }]}
          width={1}
          fill={bg}
        />
        <textarea
          ref={commit.textarea}
          focused={editing}
          initialValue={commit.message}
          placeholder={
            commit.busy === 'generating'
              ? 'Drafting a message…'
              : 'Commit message'
          }
          width={width - 2}
          height={MESSAGE_ROWS}
          backgroundColor={field}
          focusedBackgroundColor={mix(field, palette.accent, 0.06)}
          textColor={palette.text}
          focusedTextColor={palette.text}
          placeholderColor={palette.faint}
          cursorColor={palette.accent}
          wrapMode="word"
          onContentChange={commit.onEdit}
        />
      </box>
      <Line segs={[]} width={width} fill={bg} />
      <box flexDirection="row" height={1} width={width} backgroundColor={bg}>
        <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
        <Button
          segs={[
            {
              text:
                commit.busy === 'generating'
                  ? ' ✦ … '
                  : roomy
                    ? ' ✦ Generate '
                    : ' ✦ ',
              fg: palette.accent,
              bg: field,
            },
          ]}
          bg={field}
          hoverTint={palette.accent}
          onPress={() => void commit.generate()}
        />
        <box flexGrow={1} height={1} backgroundColor={bg} />
        <Button
          segs={[
            {
              text: ' Commit ',
              fg: commit.canCommit ? palette.accentInk : palette.faint,
              bg: commit.canCommit ? palette.accent : field,
              bold: true,
            },
          ]}
          bg={commit.canCommit ? palette.accent : field}
          hoverTint={palette.text}
          onPress={() => void commit.commit()}
        />
        <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
        <Button
          segs={[
            {
              text: roomy ? ' & push ' : ' ⇡ ',
              fg: commit.canCommit ? palette.text : palette.faint,
              bg: field,
            },
          ]}
          bg={field}
          hoverTint={palette.text}
          onPress={() => void commit.commit({ andPush: true })}
        />
        <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
      </box>
    </box>
  );
}
