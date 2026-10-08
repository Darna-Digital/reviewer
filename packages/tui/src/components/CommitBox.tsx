import type { BoxRenderable } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import * as React from 'react';
import { COMMIT_BOX_CHROME } from '../app/useApp';
import { agentLabel } from '../git/commitMessage';
import { mix } from '../render/palette';
import { useAppContext } from './AppContext';
import { captureMouse } from './captureMouse';
import { Button, Line } from './Line';

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
  const rows = app.workspace.commitMessageRows;

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={bg}
    >
      <ResizeRule ruleWidth={ruleWidth} count={count} />
      <box
        height={rows}
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
          height={rows}
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
        <Button
          segs={[
            {
              text: roomy ? ` ${agentLabel(app.commitAgent)} ▾ ` : ' ▾ ',
              fg: palette.muted,
              bg: field,
            },
          ]}
          bg={field}
          hoverTint={palette.text}
          onPress={(event) =>
            actions.commitAgentMenu({ x: event.x, y: event.y + 1 })
          }
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

/**
 * The box's top rule, which is also its handle, as on the Mac: it lights up
 * under the pointer and dragging it grows or shrinks the message field.
 */
function ResizeRule({
  ruleWidth,
  count,
}: {
  ruleWidth: number;
  count: string;
}) {
  const app = useAppContext();
  const { palette, layout, workspace } = app;
  const renderer = useRenderer();
  const ref = React.useRef<BoxRenderable | null>(null);
  const [active, setActive] = React.useState(false);
  const rule = active ? palette.accent : palette.rule;
  const glyph = active ? '━' : '─';
  return (
    <box
      ref={ref}
      height={1}
      width={layout.sidebarWidth}
      onMouseDown={() => captureMouse(renderer, ref.current)}
      onMouseDrag={(event) =>
        workspace.resizeCommitMessage(
          SIDEBAR_TOP + layout.bodyHeight - event.y - COMMIT_BOX_CHROME,
        )
      }
      onMouseOver={() => setActive(true)}
      onMouseOut={() => setActive(false)}
      onMouseDragEnd={() => setActive(false)}
    >
      <Line
        segs={[
          { text: `${glyph} `, fg: rule },
          {
            text: 'COMMIT ',
            fg: active ? palette.accent : palette.faint,
            bold: true,
          },
          { text: glyph.repeat(ruleWidth), fg: rule },
          { text: ` ${count}`, fg: palette.faint },
        ]}
        width={layout.sidebarWidth}
        fill={palette.frame}
      />
    </box>
  );
}

/** The sidebar starts under the top rail. */
const SIDEBAR_TOP = 0;
