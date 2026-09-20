/**
 * The pane beside the results: the file a usage is in, highlighted, scrolled to
 * the line, with that line held lit.
 *
 * The whole file rather than a window cut out of it — which is what makes the
 * pane worth having. A dozen lines of context is what a list row already gives;
 * the reason to look at a result before opening it is to read around it, so the
 * pane is the real file and scrolls like one.
 *
 * It is the app's own read-only file view, so it is coloured by the same Shiki
 * worker pool as the diff and the editor, and a file already read anywhere else
 * in the window paints from that cache on its first frame instead of flashing
 * plain. The line is marked with a rule in the view's own stylesheet rather than
 * by touching its DOM: `@pierre/diffs` owns every node under its shadow root
 * and recycles them as the virtualiser scrolls, so an attribute set by hand is
 * gone the moment the line leaves the viewport and comes back.
 */
import { File, Virtualizer } from "@pierre/diffs/react";
import { useCallback, useMemo, useRef } from "react";
import {
  THEMES,
  fileForHighlighting,
  useHighlightPrimed,
} from "@/components/editor/highlighter";
import { UnsupportedFile } from "@/components/editor/unsupported-file";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { useRevealLine } from "@/interactions/language/components/use-reveal-line";
import { useFile } from "@/lib/queries";
import type { Theme } from "@/lib/ui-prefs";
import type { Location } from "@reviewer/core/language";

/**
 * The band under the usage. The accent blue rather than the grey selection in
 * the tree beside it: the two are showing the same result and would otherwise
 * compete for the eye, and blue is what a macOS search dialog lights a match
 * with — inside the shell it is the system accent itself.
 */
const selectedLineCSS = (line: number): string => `
[data-line="${line}"] {
  background-color: color-mix(in oklab, var(--ring-accent, #00a6f4) 18%, transparent);
}
`;

export function UsagePreview({
  location,
  theme,
}: {
  /** The usage to show, or null while nothing is selected. */
  readonly location: Location | null;
  readonly theme: Theme;
}) {
  const path = location?.path ?? null;
  const line = location === null ? null : location.range.start.line + 1;
  const file = useFile(path);
  const contents = file.data?.contents;

  const highlightFile = useMemo(
    () =>
      path === null || contents === undefined
        ? null
        : fileForHighlighting(path, contents),
    [path, contents]
  );
  const primed = useHighlightPrimed(highlightFile, true);

  const scrollWrapper = useRef<HTMLDivElement>(null);
  const getScroller = useCallback(() => {
    const scroller = scrollWrapper.current?.firstElementChild;
    return scroller instanceof HTMLElement ? scroller : null;
  }, []);

  /**
   * Everywhere else a reveal is asked for twice in a row and needs a counter to
   * say so; here the target is the selection, so asking for the line that is
   * already lit is asking for nothing. The path and the line are the whole
   * request, and a constant key keeps them the only thing that re-runs it.
   */
  const reveal = useMemo(
    () => (path === null || line === null ? null : { path, line, key: 0 }),
    [path, line]
  );
  useRevealLine(
    getScroller,
    reveal,
    contents === undefined ? 0 : contents.split("\n").length,
    path ?? "",
    // No flash: the line stays lit for as long as it is the selected result,
    // and a pulse over that would only say the same thing twice.
    false
  );

  if (location === null || path === null) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-xs text-muted-foreground">
        Select a usage to preview it.
      </div>
    );
  }
  if (file.isPending || !primed) {
    return (
      <div className="p-6">
        <LoadingCursor label={`Loading ${path}…`} />
      </div>
    );
  }
  if (file.error || file.data === undefined || highlightFile === null) {
    return (
      <div className="p-6 text-xs text-destructive">Could not open {path}</div>
    );
  }
  if (file.data.binary) {
    return <UnsupportedFile path={path} sizeBytes={file.data.sizeBytes} />;
  }

  return (
    <div ref={scrollWrapper} className="relative h-full">
      <Virtualizer className="h-full overflow-auto">
        <section className="diff-file">
          {/* Remounted per file: a `File` neither re-highlights on a new `file`
              prop nor re-attaches, so swapping files in place would leave the
              previous one's text on screen under the new one's name. */}
          <File
            key={path}
            file={highlightFile}
            options={{
              theme: THEMES,
              themeType: theme,
              overflow: "wrap",
              stickyHeader: false,
              // The pane's own header carries the path and the line; the view's
              // would say it a second time, in a bar that scrolls away.
              disableFileHeader: true,
              unsafeCSS: line === null ? "" : selectedLineCSS(line),
            }}
          />
        </section>
      </Virtualizer>
    </div>
  );
}
