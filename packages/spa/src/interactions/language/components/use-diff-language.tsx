/**
 * TypeScript in the diff view.
 *
 * A diff is two files at once, and only one of them is on disk: for a worktree
 * diff the additions side *is* the working tree, which is what the language
 * server has an opinion about. The deletions side is the previous revision, and
 * asking about a symbol there would answer from the wrong file. So everything
 * here is gated on the side the pointer is actually over — which the diff token
 * hooks report, so it never has to be inferred from the DOM.
 *
 * Token squiggles are deliberately absent. Painting them means finding the
 * additions rows in the rendered grid, and in split mode each column numbers by
 * its own side, so a row alone does not say which file its number belongs to.
 * Diagnostics show as line annotations instead, which carry a side explicitly.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DiffLineAnnotation,
  DiffTokenEventBaseProps,
} from "@pierre/diffs";
import type { Diagnostic, Location } from "@byconvo/core/language";
import {
  useLanguageLayer,
  type DiagnosticsAnnotationMeta,
} from "./language-layer";

export interface DiffLanguageOptions {
  /** Repository-relative path of the file the diff is of. */
  readonly path: string;
  /** The section the rendered diff lives in. */
  readonly section: HTMLElement | null;
  /**
   * Only a worktree diff has its additions side on disk. Against a commit or a
   * pull request the additions side is a past revision that the language server
   * would answer about from the current one, so the layer stays off.
   */
  readonly enabled: boolean;
  readonly onOpenLocation: (path: string, lineNumber: number) => void;
}

export interface DiffLanguage {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  /** Merge into the section's `lineAnnotations`. */
  readonly annotations: ReadonlyArray<
    DiffLineAnnotation<DiagnosticsAnnotationMeta>
  >;
  /** Spread into the section's `options`. */
  readonly viewOptions: {
    readonly useTokenTransformer: boolean;
    readonly unsafeCSS: string;
    /** Compose with the view's own: it is what says the code exists. */
    readonly onPostRender: (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => void;
    readonly onTokenEnter: (props: DiffTokenEventBaseProps) => void;
    readonly onTokenLeave: () => void;
    readonly onTokenClick: (
      props: DiffTokenEventBaseProps,
      event: MouseEvent
    ) => void;
  };
  /** Render inside the section. */
  readonly card: React.ReactNode;
}

export function useDiffLanguage({
  path,
  section,
  enabled,
  onOpenLocation,
}: DiffLanguageOptions): DiffLanguage {
  // A diff pane holds every changed file at once, and asking about all of them
  // on mount means a burst of requests for files the user cannot see — enough
  // of them to keep the language server busy while the first screen waits. A
  // file is asked about once it comes near the viewport, and stays asked about
  // afterwards so scrolling back is instant.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || section === null || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: "400px" }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [enabled, section, seen]);

  const getContainer = useCallback(() => section, [section]);

  const layer = useLanguageLayer({
    path,
    // A diff is read-only: nothing to type into, nothing to apply a fix to.
    editor: null,
    getContainer,
    enabled: enabled && seen,
    // Two files are interleaved here, so a rendered line number is only this
    // file's on the additions side.
    lineNumbersMatchFile: false,
    onOpenLocation: useCallback(
      (location: Location) =>
        onOpenLocation(location.path, location.range.start.line + 1),
      [onOpenLocation]
    ),
  });

  const { onPostRender, onTokenEnter, onTokenLeave, onTokenClick } =
    layer.viewOptions;

  const viewOptions = useMemo(
    () => ({
      useTokenTransformer: true,
      unsafeCSS: layer.viewOptions.unsafeCSS,
      onPostRender,
      onTokenEnter: (props: DiffTokenEventBaseProps) => {
        if (props.side !== "additions") return;
        onTokenEnter(props);
      },
      onTokenLeave,
      onTokenClick: (props: DiffTokenEventBaseProps, event: MouseEvent) => {
        if (props.side !== "additions") return;
        onTokenClick(props, event);
      },
    }),
    [
      layer.viewOptions.unsafeCSS,
      onPostRender,
      onTokenClick,
      onTokenEnter,
      onTokenLeave,
    ]
  );

  const annotations = useMemo(
    () =>
      layer.annotations.map((annotation) => ({
        ...annotation,
        side: "additions" as const,
      })),
    [layer.annotations]
  );

  return {
    diagnostics: layer.diagnostics,
    annotations,
    viewOptions,
    card: layer.card,
  };
}
