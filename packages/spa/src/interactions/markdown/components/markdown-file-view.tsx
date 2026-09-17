/**
 * A markdown file, in whichever of its three readings the user has asked for:
 * the source, the document, or both side by side.
 *
 * The code view is mounted in all three, and only taken off screen when the
 * document is alone. That is the whole trick the feature rests on: it stays the
 * one owner of the file — the buffer, the dirty marker, ⌘S, format on save, the
 * review comments anchored to its lines — so there is never a second copy of
 * the document to reconcile, and switching views cannot lose an edit because
 * nothing is torn down when you switch. The document editor beside it reads and
 * writes through the bridge the code view publishes.
 *
 * Off screen, not `display: none`. The code view windows itself with an
 * `IntersectionObserver`, so a pane with no layout box never decides it is
 * visible, never renders a line, and never builds the editor the bridge is made
 * of — the document would sit for ever on "opening". Kept at full size with no
 * opacity, it hydrates normally and can be typed through.
 *
 * Which reading you are in is a preference, not part of the route: it is a way
 * of working with markdown, not a property of one file, and it should still be
 * the way you were working when you open the next one.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CodeView } from "@/components/editor/code-view";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { useFile } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import {
  showsDocument,
  showsSource,
} from "../functions/markdown-view.functions";
import type { FileBufferBridge } from "../interfaces/markdown.interfaces";
import { BlockEditor } from "./block-editor";
import { MarkdownViewSwitch } from "./markdown-view-switch";

type CodeViewProps = React.ComponentProps<typeof CodeView>;

export function MarkdownFileView(props: CodeViewProps) {
  const prefs = useUiPrefs();
  const view = prefs.markdownView;
  const withDocument = showsDocument(view);
  const withSource = showsSource(view);

  // Not React state — see `usePanelSize`. The split's source column is sized on
  // its own rather than sharing the SVG view's: one holds code beside a picture
  // and the other holds two readings of the same prose.
  const sourceColumn = usePanelSize(
    "md-source-w",
    prefs.markdownSourceWidth,
    "width"
  );

  const [bridge, setBridge] = useState<FileBufferBridge | null>(null);
  // Held as state, not a ref: the document pane has to render again when the
  // handle arrives, which is an effect after the code view has mounted.
  const onBuffer = useCallback(
    (next: FileBufferBridge | null) => setBridge(next),
    []
  );

  return (
    <div className="relative flex h-full min-h-0">
      {props.actionsSlot !== null &&
        props.actionsSlot !== undefined &&
        createPortal(
          <MarkdownViewSwitch
            view={view}
            onChange={(next) => setUiPrefs({ markdownView: next })}
          />,
          props.actionsSlot
        )}

      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden",
          withSource
            ? withDocument
              ? "shrink-0"
              : "min-w-0 flex-1"
            : "absolute inset-0 -z-10 opacity-0"
        )}
        // `inert` rather than a hidden attribute: it keeps the pane out of the
        // tab order and away from the pointer while leaving it laid out, which
        // is the whole reason it is still here.
        inert={!withSource}
        // Capped as a share of the pane so the document keeps its side in a
        // narrow window, where the stored pixel width would push it off-screen.
        style={
          withSource && withDocument
            ? { ...sourceColumn.style, maxWidth: "60%" }
            : undefined
        }
      >
        {/* A document on screen is a document to type into, whatever the edit
            mode says: comment mode would otherwise leave the block editor
            showing the file and refusing every keystroke, since it writes
            through the buffer this view owns and comment mode keeps none.
            Source alone still follows the mode, which is where the mode is
            about something the user can see. */}
        <CodeView
          {...props}
          onBuffer={onBuffer}
          editing={withDocument ? true : undefined}
        />
      </div>

      {withSource && withDocument && (
        <ResizeHandle
          orientation="col"
          value={sourceColumn.current}
          min={280}
          max={() => Math.max(360, window.innerWidth - 420)}
          onResize={sourceColumn.onResize}
          onResizeEnd={(width) => setUiPrefs({ markdownSourceWidth: width })}
          label="Resize markdown source pane"
          className="resize-handle-divider"
        />
      )}

      {withDocument && (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-background">
          <DocumentPane path={props.path} bridge={bridge} />
        </div>
      )}
    </div>
  );
}

/**
 * The document editor over the code view's buffer.
 *
 * It falls back to the file on disk when there is no buffer to share. The code
 * view has no editor to lend while the file is still being read, and none at
 * all in comment mode, where the whole point is that the file is not being
 * typed into — a document that shows itself and refuses edits is the honest
 * answer to both, and far better than a spinner that never resolves.
 */
function DocumentPane({
  path,
  bridge,
}: {
  path: string;
  bridge: FileBufferBridge | null;
}) {
  const file = useFile(path);
  const live = useBufferText(bridge);
  const text = live ?? file.data?.contents;

  if (text === undefined) {
    return (
      <div className="p-8">
        <LoadingCursor label={`Loading ${path}…`} />
      </div>
    );
  }

  return (
    <BlockEditor
      value={text}
      editable={bridge !== null}
      onChange={bridge === null ? noop : bridge.write}
      className="mx-auto max-w-3xl px-6 py-8"
    />
  );
}

const noop = () => {};

/**
 * The shared buffer's text, kept current as the other pane is typed into, or
 * null while there is no buffer to share.
 */
function useBufferText(bridge: FileBufferBridge | null): string | null {
  const [text, setText] = useState<string | null>(null);
  const latest = useRef<string | null>(null);

  useEffect(() => {
    if (bridge === null) {
      latest.current = null;
      setText(null);
      return;
    }
    const sync = () => {
      const next = bridge.read();
      // Every keystroke on either side reaches here; only a change is news.
      if (next === latest.current) return;
      latest.current = next;
      setText(next);
    };
    sync();
    return bridge.subscribe(sync);
  }, [bridge]);

  return text;
}
