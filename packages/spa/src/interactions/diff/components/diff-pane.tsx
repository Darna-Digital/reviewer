import type {
  CodeViewDiffItem,
  CodeViewItem,
  CodeViewLineSelection,
  CodeViewOptions,
  DiffLineAnnotation,
  FileDiffLoadedFiles,
  FileDiffMetadata,
  Hunk,
  LineAnnotation,
} from "@pierre/diffs";
import {
  CodeView,
  type CodeViewHandle,
  type CodeViewProps,
} from "@pierre/diffs/react";
import {
  IconArrowBackUp,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconHistory,
} from "@tabler/icons-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { confirm } from "@/components/ui/alerts";
import { Button } from "@/components/ui/button";
import { useCodeThemes } from "@/components/editor/highlighter";
import { Orb } from "@/components/ui/orb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommentThread,
  DraftCard,
  type DraftLocation,
} from "@/interactions/comments/components/comment-thread";
import {
  ConnectorPainter,
  connectorsCSS,
} from "@/interactions/diff/components/diff-connectors";
import {
  type DiffFileInView,
  setDiffFileInView,
} from "@/interactions/diff/adapters/diff-file-in-view.store";
import { setDiffNarrowed } from "@/interactions/diff/adapters/diff-layout.store";
import {
  isNarrowedToUnified,
  resolveDiffStyle,
} from "@/interactions/diff/functions/diff-style.functions";
import { DiagnosticsAnnotation } from "@/interactions/language/components/diagnostics-annotation";
import {
  useDiffLanguage,
  type DiffLanguage,
} from "@/interactions/language/components/use-diff-language";
import type { DiagnosticsAnnotationMeta } from "@/interactions/language/components/language-layer";
import { DIAGNOSTIC_CSS } from "@/interactions/language/functions/diagnostic-styles";
import { fetchClient } from "@/lib/api/client";
import { selectionShadingCSS } from "@/lib/code-selection-css";
import {
  useStableCallback,
  useStableOptionalCallback,
} from "@/lib/stable-callback";
import { diffTargetKey, type DiffTarget } from "@/lib/api/types";
import type { CommentSide, ReviewComment } from "@reviewer/core/comments";
import type { DiffStyle, Theme } from "@/lib/ui-prefs";

export type { DraftLocation };

type AnnotationMeta =
  | {
      readonly kind: "comments";
      readonly comments: ReadonlyArray<ReviewComment>;
    }
  // The body travels with the draft so a composer reopened after a refused
  // write comes back holding what was typed. Absent for a fresh draft.
  | { readonly kind: "draft"; readonly body?: string }
  | { readonly kind: "hunk"; readonly hunkIndex: number }
  | DiagnosticsAnnotationMeta;

type Annotation = DiffLineAnnotation<AnnotationMeta>;
type DiffItem = CodeViewDiffItem<AnnotationMeta>;
type Viewer = CodeViewHandle<AnnotationMeta, undefined>;
type ViewerOptions = CodeViewOptions<AnnotationMeta, undefined>;
type ViewerScrollListener = NonNullable<
  CodeViewProps<AnnotationMeta, undefined>["onScroll"]
>;

/**
 * How far down the viewport the reading line sits, as a share of its height:
 * the file whose top has crossed it is the one in view. The very top edge
 * would hand the name over while the eye is still on the file above; a third
 * of the way down is where the next file has plainly taken the pane.
 */
const READING_LINE = 1 / 3;

interface DiffPaneProps {
  files: ReadonlyArray<FileDiffMetadata>;
  theme: Theme;
  diffStyle: DiffStyle;
  connectors: boolean;
  loading: boolean;
  error: string | null;
  target: DiffTarget;
  comments: ReadonlyArray<ReviewComment>;
  draft: DraftLocation | null;
  selectedFile: string | null;
  onDraftOpen: (draft: DraftLocation) => void;
  onDraftCancel: () => void;
  onEditFile: (path: string) => void;
  /** Open a file's commit history in the bottom dock. */
  onShowFileHistory?: (path: string) => void;
  /** Discard a file's worktree changes (revert to HEAD). Only wired in commit
   * mode, where the diff is the working tree; absent means no discard control. */
  onDiscardFile?: (path: string) => void;
  /** Discard a single hunk of a file's worktree diff. Only wired in commit mode;
   * absent means no per-hunk discard control is rendered. */
  onDiscardHunk?: (path: string, hunkIndex: number) => void;
  onCommentSubmit: (location: DraftLocation, body: string) => Promise<void>;
  onCommentDelete: (comment: ReviewComment) => Promise<void>;
  onCommentEdit: (comment: ReviewComment, body: string) => Promise<void>;
  onCommentReply: (comment: ReviewComment, body: string) => Promise<void>;
  /** Go-to-definition and find-usages land here. */
  onOpenLocation: (path: string, lineNumber: number) => void;
}

const emptyHint = (target: DiffTarget): string => {
  switch (target.kind) {
    case "worktree":
      return "Working tree is clean — make some changes and hit refresh.";
    case "branch":
      return `Nothing yet on this branch that ${target.target} does not already have.`;
    case "range":
      return "These refs are identical.";
    case "commit":
      return "This commit has no textual changes.";
    case "pull":
      return "This merge request has no diff.";
  }
};

/**
 * The room under the last file, so its last lines clear the floating bars
 * that hang over the bottom of the pane (the assign bar). The files stand a
 * pixel apart, which is where the rule between them is drawn (see
 * `.diff-pane diffs-container` in styles.css).
 */
const LAYOUT = { paddingTop: 0, gap: 1, paddingBottom: 80 } as const;

/**
 * Opening every collapsed region of a file at once: the count is clamped to
 * what each region holds, so one number serves every hunk.
 */
const WHOLE_REGION = 1_000_000_000;

/**
 * The `/api/diff-file` params that pin both sides of `target`, so expanded
 * context comes from the same refs the diff was generated from. A pull is
 * served best-effort from the local clone: GitHub's PR diff is
 * merge-base(base, head) → head, which resolves once the PR's commits have
 * been fetched (and fails harmlessly — see loader below — when they haven't).
 */
const diffFileTargetQuery = (
  target: DiffTarget
): {
  commit?: string;
  base?: string;
  head?: string;
  target?: string;
} => {
  switch (target.kind) {
    case "worktree":
      return {};
    case "branch":
      return { target: target.target };
    case "commit":
      return { commit: target.sha };
    case "range":
      return { base: target.base, head: target.head };
    case "pull":
      return {
        base: `origin/${target.pull.baseRef}`,
        head: target.pull.headSha,
      };
  }
};

/**
 * Where a hunk's discard control anchors: the line just above the hunk's first
 * *changed* line (annotations render below their anchor, so this lands the
 * control directly above the change — not on the leading context, and not
 * splitting the change). Falls back to the first changed line when the change
 * opens the hunk with no leading context.
 */
const hunkChangeAnchor = (
  hunk: Hunk
): { side: CommentSide; lineNumber: number } => {
  let addition = hunk.additionStart;
  let deletion = hunk.deletionStart;
  let sawContext = false;
  for (const block of hunk.hunkContent) {
    if (block.type === "context") {
      addition += block.lines;
      deletion += block.lines;
      sawContext = true;
      continue;
    }
    return block.additions > 0
      ? { side: "additions", lineNumber: sawContext ? addition - 1 : addition }
      : { side: "deletions", lineNumber: sawContext ? deletion - 1 : deletion };
  }
  return { side: "additions", lineNumber: hunk.additionStart };
};

/** A file with no comments, draft or hunk control — one array, not one each. */
const NO_ANNOTATIONS: ReadonlyArray<Annotation> = [];

const sameAnnotations = (
  a: ReadonlyArray<Annotation>,
  b: ReadonlyArray<Annotation>
): boolean => a.length === b.length && a.every((entry, i) => entry === b[i]);

/**
 * Per-file "show the whole file" choices. A file is opened by expanding every
 * collapsed region of its rendered instance, and closed by giving it a fresh
 * instance — the viewer keeps an item's expansions for as long as its id
 * lives, so a collapse is a new id: the name and a generation.
 */
interface Expansion {
  readonly expanded: ReadonlySet<string>;
  readonly generation: ReadonlyMap<string, number>;
}

const NO_EXPANSION: Expansion = { expanded: new Set(), generation: new Map() };

const itemIdOf = (name: string, expansion: Expansion): string => {
  const generation = expansion.generation.get(name) ?? 0;
  return generation === 0 ? name : `${name}@${generation}`;
};

/**
 * What the viewer remembers of an item between renders, so the version only
 * moves when something the item renders from has: its diff, its annotations,
 * or whether it is shown whole. The viewer reconciles by id and version, and
 * a version that moved for nothing is a file laid out again for nothing.
 */
interface ItemRecord {
  fileDiff: FileDiffMetadata;
  annotations: ReadonlyArray<Annotation>;
  expanded: boolean;
  version: number;
}

interface FileLanguageProps {
  path: string;
  itemId: string;
  /** The item's element while the viewer has it rendered. */
  element: HTMLElement | null;
  enabled: boolean;
  drafting: boolean;
  register: (itemId: string, viewOptions: DiffLanguage["viewOptions"]) => void;
  unregister: (itemId: string) => void;
  report: (
    path: string,
    annotations: ReadonlyArray<DiffLineAnnotation<DiagnosticsAnnotationMeta>>
  ) => void;
  onOpenLocation: (path: string, lineNumber: number) => void;
}

/**
 * The language layer for one file of the diff — hover documentation,
 * go-to-definition, the symbol menu, diagnostics — with nothing of its own to
 * draw but the card and the menu. `CodeView` renders every file itself and hands its callbacks one
 * `context` at a time, so the per-file hooks live here, headless: the token
 * handlers are registered under the item's id for the viewer's shared
 * callbacks to route to, and the diagnostics go up as annotations for the
 * item to carry.
 */
const FileLanguage = memo(function FileLanguageView({
  path,
  itemId,
  element,
  enabled,
  drafting,
  register,
  unregister,
  report,
  onOpenLocation,
}: FileLanguageProps) {
  const language = useDiffLanguage({
    path,
    section: element,
    enabled,
    // The composer sits under the line the comment is about, exactly where the
    // card would be drawn.
    hoverEnabled: !drafting,
    onOpenLocation,
  });

  // Layout, not passive: the viewer can render the item — and ask for its
  // handlers — in the same commit.
  useLayoutEffect(() => {
    register(itemId, language.viewOptions);
    return () => unregister(itemId);
  }, [itemId, language.viewOptions, register, unregister]);

  useEffect(() => {
    report(path, language.annotations);
  }, [language.annotations, path, report]);

  return (
    <>
      {language.card}
      {language.menu}
    </>
  );
});

export function DiffPane({
  files,
  theme,
  diffStyle,
  connectors,
  loading,
  error,
  target,
  comments,
  draft,
  selectedFile,
  onDraftOpen: rawOnDraftOpen,
  onDraftCancel: rawOnDraftCancel,
  onEditFile: rawOnEditFile,
  onShowFileHistory: rawOnShowFileHistory,
  onDiscardFile: rawOnDiscardFile,
  onDiscardHunk: rawOnDiscardHunk,
  onCommentSubmit: rawOnCommentSubmit,
  onCommentDelete: rawOnCommentDelete,
  onCommentEdit: rawOnCommentEdit,
  onCommentReply: rawOnCommentReply,
  onOpenLocation: rawOnOpenLocation,
}: DiffPaneProps) {
  const codeThemes = useCodeThemes();
  // Every handler arrives from the shell as a fresh closure on each of its
  // renders. The viewer's render callbacks and options are memoised on what
  // they read, and a changed callback would have every rendered file drawn
  // again; pinned here, in one place, rather than asking the shell to
  // hand-memoise a dozen callbacks — see `useStableCallback`. The optional
  // ones keep their absence, which is what decides whether a control is
  // rendered at all.
  const onDraftOpen = useStableCallback(rawOnDraftOpen);
  const onDraftCancel = useStableCallback(rawOnDraftCancel);
  const onEditFile = useStableCallback(rawOnEditFile);
  const onOpenLocation = useStableCallback(rawOnOpenLocation);
  const onCommentSubmit = useStableCallback(rawOnCommentSubmit);
  const onCommentDelete = useStableCallback(rawOnCommentDelete);
  const onCommentEdit = useStableCallback(rawOnCommentEdit);
  const onCommentReply = useStableCallback(rawOnCommentReply);
  const onShowFileHistory = useStableOptionalCallback(rawOnShowFileHistory);
  const onDiscardFile = useStableOptionalCallback(rawOnDiscardFile);
  const onDiscardHunk = useStableOptionalCallback(rawOnDiscardHunk);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  /**
   * Side-by-side needs room for two columns of code. In a three-column review
   * window — pull requests, then the file tree, then this — a narrow enough
   * window leaves it without that room, and the diff would be read through two
   * horizontal scrollbars. So the pane measures itself and lays the diff out
   * inline when it is too narrow, whatever the preference says.
   *
   * Measured off this element rather than the window: what decides is the room
   * the diff has, and the other two columns can take most of a wide window.
   */
  const [paneWidth, setPaneWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    setPaneWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setPaneWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
    // Re-attached when the pane comes back after an empty/loading state, which
    // renders a different element and would otherwise leave the ref stale.
  }, [loading, error, files.length]);

  const laidOut = resolveDiffStyle(diffStyle, paneWidth);
  const connectorsEnabled = connectors && laidOut === "split";

  // Told to the header, so the layout toggle can say it has been overruled
  // rather than sitting on "Horizontal" over a diff that plainly is not.
  const narrowed = isNarrowedToUnified(diffStyle, paneWidth);
  useEffect(() => {
    setDiffNarrowed(narrowed);
    return () => setDiffNarrowed(false);
  }, [narrowed]);

  // Per-file "show the whole file" choices, scoped to the current target: the
  // stored key invalidates the set when the user navigates to another diff, so
  // stale expansions never leak across targets (no effect/reset dance needed).
  const targetKey = diffTargetKey(target);
  const [expansionState, setExpansionState] = useState<{
    key: string;
    expansion: Expansion;
  }>({ key: targetKey, expansion: NO_EXPANSION });
  const expansion =
    expansionState.key === targetKey ? expansionState.expansion : NO_EXPANSION;
  const expansionRef = useRef(expansion);
  expansionRef.current = expansion;

  const collapseFile = useCallback(
    (name: string) =>
      setExpansionState((prev) => {
        const current = prev.key === targetKey ? prev.expansion : NO_EXPANSION;
        if (!current.expanded.has(name)) return prev;
        const expanded = new Set(current.expanded);
        expanded.delete(name);
        const generation = new Map(current.generation);
        generation.set(name, (generation.get(name) ?? 0) + 1);
        return { key: targetKey, expansion: { expanded, generation } };
      }),
    [targetKey]
  );

  const toggleExpanded = useCallback(
    (name: string) => {
      if (expansionRef.current.expanded.has(name)) {
        collapseFile(name);
        return;
      }
      const id = itemIdOf(name, expansionRef.current);
      const rendered = viewerRef.current
        ?.getInstance()
        ?.getRenderedItems()
        .find((item) => item.id === id);
      if (rendered === undefined || rendered.type !== "diff") return;
      rendered.item.fileDiff.hunks.forEach((_, hunkIndex) => {
        rendered.instance.expandHunk(hunkIndex, "both", WHOLE_REGION);
      });
      setExpansionState((prev) => {
        const current = prev.key === targetKey ? prev.expansion : NO_EXPANSION;
        const expanded = new Set(current.expanded);
        expanded.add(name);
        return {
          key: targetKey,
          expansion: { expanded, generation: current.generation },
        };
      });
    },
    [collapseFile, targetKey]
  );

  // Fetch both full sides of a file so @pierre/diffs can render the unchanged
  // regions (per-hunk expansion and the "full file" view). Throwing is the
  // loader's "not available" signal — the library keeps the collapsed,
  // hunks-only rendering — so on failure we also toast (a silent no-op click
  // reads as a broken button) and flip the file back to collapsed, keeping the
  // header toggle truthful. Typical failures: a server build without
  // /api/diff-file, or a PR whose commits haven't been fetched yet.
  const loadDiffFiles = useCallback(
    async (file: FileDiffMetadata): Promise<FileDiffLoadedFiles> => {
      try {
        const { data, error: fetchError } = await fetchClient.GET(
          "/api/diff-file",
          {
            params: {
              query: {
                ...diffFileTargetQuery(target),
                path: file.name,
                ...(file.prevName != null ? { prevPath: file.prevName } : {}),
              },
            },
          }
        );
        if (fetchError !== undefined || data === undefined)
          throw new Error(`Could not load contents for ${file.name}`);
        if (data.newContents === null)
          throw new Error(`No diff contents available for ${file.name}`);
        const newFile = { name: file.name, contents: data.newContents };
        if (file.type === "rename-pure") return { oldFile: null, newFile };
        if (data.oldContents === null)
          throw new Error(`No previous contents available for ${file.name}`);
        return {
          oldFile: {
            name: file.prevName ?? file.name,
            contents: data.oldContents,
          },
          newFile,
        };
      } catch (failure) {
        toast.error(`Couldn't load the rest of ${file.name}`, {
          description:
            target.kind === "pull"
              ? "The merge request's commits may not be fetched locally yet — try Fetch, then expand again."
              : "The server couldn't provide this file's full contents.",
        });
        collapseFile(file.name);
        throw failure;
      }
    },
    [collapseFile, target]
  );

  // The language layer's handlers, one set per file, under the item's id —
  // see `FileLanguage`. A ref rather than state: they are read from inside
  // the viewer's callbacks, and registering one is not a reason to render.
  const languageByItem = useRef(new Map<string, DiffLanguage["viewOptions"]>());
  const registerLanguage = useCallback(
    (itemId: string, viewOptions: DiffLanguage["viewOptions"]) => {
      languageByItem.current.set(itemId, viewOptions);
    },
    []
  );
  const unregisterLanguage = useCallback((itemId: string) => {
    languageByItem.current.delete(itemId);
  }, []);

  // Which items the viewer has rendered, by their elements: what each file's
  // language layer attaches to. Kept as state, since it is what the layer
  // hooks read; changed only on a mount or an unmount, so a scroll that
  // re-renders an item in place moves nothing here.
  const [elements, setElements] = useState<ReadonlyMap<string, HTMLElement>>(
    () => new Map()
  );
  const rememberElement = useCallback(
    (itemId: string, element: HTMLElement | null) =>
      setElements((prev) => {
        if ((prev.get(itemId) ?? null) === element) return prev;
        const next = new Map(prev);
        if (element === null) next.delete(itemId);
        else next.set(itemId, element);
        return next;
      }),
    []
  );

  const [diagnosticsByFile, setDiagnosticsByFile] = useState<
    ReadonlyMap<
      string,
      ReadonlyArray<DiffLineAnnotation<DiagnosticsAnnotationMeta>>
    >
  >(() => new Map());
  const reportDiagnostics = useCallback(
    (
      path: string,
      annotations: ReadonlyArray<DiffLineAnnotation<DiagnosticsAnnotationMeta>>
    ) =>
      setDiagnosticsByFile((prev) => {
        const current = prev.get(path);
        if (current === annotations) return prev;
        if (current === undefined && annotations.length === 0) return prev;
        const next = new Map(prev);
        if (annotations.length === 0) next.delete(path);
        else next.set(path, annotations);
        return next;
      }),
    []
  );

  const annotationsByFile = useMemo(() => {
    const result = new Map<string, Array<Annotation>>();
    const grouped = new Map<
      string,
      {
        filePath: string;
        side: CommentSide;
        lineNumber: number;
        comments: ReviewComment[];
      }
    >();
    for (const c of comments) {
      const key = `${c.side}:${c.lineNumber}:${c.filePath}`;
      const bucket = grouped.get(key);
      if (bucket) bucket.comments.push(c);
      else
        grouped.set(key, {
          filePath: c.filePath,
          side: c.side,
          lineNumber: c.lineNumber,
          comments: [c],
        });
    }
    for (const g of grouped.values()) {
      const arr = result.get(g.filePath) ?? [];
      arr.push({
        side: g.side,
        lineNumber: g.lineNumber,
        metadata: { kind: "comments", comments: g.comments },
      });
      result.set(g.filePath, arr);
    }
    if (draft !== null) {
      const arr = result.get(draft.filePath) ?? [];
      arr.push({
        side: draft.side,
        lineNumber: draft.lineNumber,
        metadata:
          draft.body === undefined
            ? { kind: "draft" }
            : { kind: "draft", body: draft.body },
      });
      result.set(draft.filePath, arr);
    }
    // Anchor a "Discard hunk" control at the start of each hunk. Only in commit
    // mode (onDiscardHunk provided); hunk order here matches the server's
    // `git diff HEAD -- <path>`, so the index round-trips to the discard call.
    if (onDiscardHunk !== undefined) {
      for (const file of files) {
        const arr = result.get(file.name) ?? [];
        file.hunks.forEach((hunk, hunkIndex) => {
          const anchor = hunkChangeAnchor(hunk);
          arr.push({
            side: anchor.side,
            lineNumber: anchor.lineNumber,
            metadata: { kind: "hunk", hunkIndex },
          });
        });
        result.set(file.name, arr);
      }
    }
    for (const [path, diagnostics] of diagnosticsByFile) {
      const arr = result.get(path) ?? [];
      arr.push(...diagnostics);
      result.set(path, arr);
    }
    return result;
  }, [comments, diagnosticsByFile, draft, files, onDiscardHunk]);

  // The viewer's items: one per changed file, versioned so the viewer lays a
  // file out again only when it has something new to lay out — see
  // `ItemRecord`. The annotation arrays are built afresh above, but from
  // elements that only change when their file's do, so an unchanged file's
  // array is the same entries in the same order and its version stands.
  const records = useRef(new Map<string, ItemRecord>());
  const items = useMemo<ReadonlyArray<DiffItem>>(() => {
    const seen = new Set<string>();
    const next = files.map((file): DiffItem => {
      const id = itemIdOf(file.name, expansion);
      seen.add(id);
      const annotations = annotationsByFile.get(file.name) ?? NO_ANNOTATIONS;
      const expanded = expansion.expanded.has(file.name);
      const previous = records.current.get(id);
      const version =
        previous === undefined
          ? 0
          : previous.fileDiff !== file ||
              previous.expanded !== expanded ||
              !sameAnnotations(previous.annotations, annotations)
            ? previous.version + 1
            : previous.version;
      records.current.set(id, {
        fileDiff: file,
        annotations,
        expanded,
        version,
      });
      return {
        id,
        type: "diff",
        fileDiff: file,
        annotations: [...annotations],
        version,
      };
    });
    for (const id of records.current.keys()) {
      if (!seen.has(id)) records.current.delete(id);
    }
    return next;
  }, [annotationsByFile, expansion, files]);

  const itemIdByFile = useMemo(
    () => new Map(items.map((item) => [item.fileDiff.name, item.id])),
    [items]
  );
  const itemIdByFileRef = useRef(itemIdByFile);
  itemIdByFileRef.current = itemIdByFile;

  // The selected file to the top of the pane, on the viewer's own spring:
  // it resolves the item against its live layout, so the scroll stays
  // accurate while the files around it are still being measured. Once, per
  // selection: the files re-arrive on every refresh of the diff, and a
  // selection that has already been scrolled to — the first file, chosen for
  // the review as it opens — must not drag the pane back up each time.
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (selectedFile === null) return;
    if (scrolledTo.current === selectedFile) return;
    const id = itemIdByFileRef.current.get(selectedFile);
    if (id === undefined) return;
    scrolledTo.current = selectedFile;
    viewerRef.current?.scrollTo({
      type: "item",
      id,
      align: "start",
      behavior: "smooth",
    });
  }, [selectedFile, files]);

  // The file at the reading line, told to the header so it can name what the
  // pane is scrolled to. Read off the viewer's own layout rather than the DOM:
  // it has a top for every item, rendered or not, from the estimated heights it
  // corrects as they render. Refreshed on every scroll, and again whenever the
  // items change under a scroll position that has not moved.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const trackFileInView = useStableCallback<ViewerScrollListener>(
    (scrollTop, viewer) => {
      const viewportHeight = containerRef.current?.clientHeight ?? 0;
      const readingLine = scrollTop + viewportHeight * READING_LINE;
      let inView: DiffFileInView | null = null;
      for (const [index, item] of itemsRef.current.entries()) {
        const top = viewer.getTopForItem(item.id);
        if (top === undefined || top > readingLine) break;
        inView = { path: item.fileDiff.name, index };
      }
      setDiffFileInView(inView);
    }
  );
  useEffect(() => {
    const viewer = viewerRef.current?.getInstance();
    if (viewer === undefined) {
      setDiffFileInView(null);
      return;
    }
    trackFileInView(viewer.getScrollTop(), viewer);
  }, [items, loading, error, trackFileInView]);
  useEffect(() => () => setDiffFileInView(null), []);

  const selectedLines = useMemo<CodeViewLineSelection | null>(() => {
    if (draft === null) return null;
    const id = itemIdByFile.get(draft.filePath);
    if (id === undefined) return null;
    return {
      id,
      range: {
        start: draft.lineNumber,
        end: draft.lineNumber,
        side: draft.side,
        endSide: draft.side,
      },
    };
  }, [draft, itemIdByFile]);

  // The ribbons between a change's two sides, painted into each rendered
  // item as the viewer reports it rendered — and again when the pane's width
  // moves the columns, which the viewer does not re-render for.
  const painter = useMemo(() => new ConnectorPainter(), []);
  const connectorsRef = useRef(connectorsEnabled);
  connectorsRef.current = connectorsEnabled;
  useEffect(() => () => painter.clearAll(), [painter]);
  useEffect(() => {
    const rendered = viewerRef.current?.getInstance()?.getRenderedItems();
    for (const item of rendered ?? []) {
      if (connectorsEnabled) painter.schedule(item.element);
      else painter.clear(item.element);
    }
  }, [connectorsEnabled, painter, paneWidth]);

  const onPostRender = useStableCallback<
    NonNullable<ViewerOptions["onPostRender"]>
  >((node, instance, phase, context) => {
    const itemId = context.item.id;
    if (phase === "unmount") {
      painter.clear(node);
      rememberElement(itemId, null);
    } else {
      if (connectorsRef.current) painter.schedule(node);
      rememberElement(itemId, node);
    }
    languageByItem.current.get(itemId)?.onPostRender(node, instance, phase);
  });

  const options = useMemo<ViewerOptions>(
    () => ({
      theme: codeThemes,
      themeType: theme,
      diffStyle: laidOut,
      lineDiffType: "word",
      overflow: "scroll",
      stickyHeaders: false,
      layout: LAYOUT,
      // Full-file support: the loader hydrates the unchanged regions of a
      // patch-parsed diff, which both makes the hunk separators expandable
      // and lets a file be shown whole.
      loadDiffFiles,
      enableGutterUtility: true,
      // Wrap every token in its own element carrying its column, which is what
      // the language layer's token hooks resolve a symbol from.
      useTokenTransformer: true,
      unsafeCSS: [
        selectionShadingCSS,
        DIAGNOSTIC_CSS,
        connectorsEnabled ? connectorsCSS : "",
      ].join("\n"),
      onPostRender,
      onGutterUtilityClick: (range, context) => {
        if (context.item.type !== "diff") return;
        onDraftOpen({
          filePath: context.item.fileDiff.name,
          side: range.side ?? "additions",
          lineNumber: range.end,
        });
      },
      onLineNumberClick: (props, context) => {
        if (context.item.type !== "diff" || !("annotationSide" in props))
          return;
        onDraftOpen({
          filePath: context.item.fileDiff.name,
          side: props.annotationSide,
          lineNumber: props.lineNumber,
        });
      },
      onTokenEnter: (props, _event, context) => {
        if (!("side" in props)) return;
        languageByItem.current.get(context.item.id)?.onTokenEnter(props);
      },
      onTokenLeave: (_props, _event, context) => {
        languageByItem.current.get(context.item.id)?.onTokenLeave();
      },
      onTokenClick: (props, event, context) => {
        if (!("side" in props)) return;
        languageByItem.current.get(context.item.id)?.onTokenClick(props, event);
      },
    }),
    [
      connectorsEnabled,
      laidOut,
      loadDiffFiles,
      onDraftOpen,
      onPostRender,
      theme,
      codeThemes,
    ]
  );

  const renderHeaderMetadata = useStableCallback(
    (item: CodeViewItem<AnnotationMeta>) => {
      if (item.type !== "diff") return null;
      const meta = item.fileDiff;
      const expanded = expansionRef.current.expanded.has(meta.name);
      return (
        <div className="flex items-center gap-1">
          {/* New/deleted files already carry their whole content in the
           * patch, so there is nothing extra to expand. */}
          {meta.type !== "new" && meta.type !== "deleted" && (
            <Button
              variant="ghost-muted"
              size="xs"
              className="gap-1"
              aria-pressed={expanded}
              title={
                expanded
                  ? `Collapse ${meta.name} to its changed lines`
                  : `Show all of ${meta.name}`
              }
              onClick={() => toggleExpanded(meta.name)}
            >
              {expanded ? (
                <IconArrowsMinimize className="size-3.5" />
              ) : (
                <IconArrowsMaximize className="size-3.5" />
              )}
              {expanded ? "Changes only" : "Full file"}
            </Button>
          )}
          {onDiscardFile !== undefined && (
            // Revert this file to HEAD. Available for every change type
            // (a deletion is restored, an addition removed).
            <Button
              variant="ghost-muted"
              size="xs"
              className="gap-1 hover:text-destructive hover:[&_svg]:text-destructive"
              title={`Discard changes in ${meta.name}`}
              onClick={() => {
                void confirm({
                  title: "Discard all changes in this file?",
                  subject: meta.name,
                  description:
                    "This reverts the file to the last commit and cannot be undone.",
                  confirmLabel: "Discard",
                  destructive: true,
                }).then((ok) => {
                  if (ok) onDiscardFile(meta.name);
                });
              }}
            >
              <IconArrowBackUp className="size-3.5" />
              Discard
            </Button>
          )}
          {onShowFileHistory !== undefined && (
            <Button
              variant="ghost-muted"
              size="xs"
              className="gap-1"
              title={`Show the commit history of ${meta.name}`}
              onClick={() => onShowFileHistory(meta.name)}
            >
              <IconHistory className="size-3.5" />
              History
            </Button>
          )}
          {meta.type !== "deleted" && (
            <Button
              variant="ghost-muted"
              size="xs"
              onClick={() => onEditFile(meta.name)}
            >
              Edit
            </Button>
          )}
        </div>
      );
    }
  );

  const renderAnnotation = useStableCallback(
    (
      annotation: LineAnnotation<AnnotationMeta> | Annotation,
      item: CodeViewItem<AnnotationMeta>
    ) => {
      if (item.type !== "diff" || !("side" in annotation)) return null;
      const meta = annotation.metadata;
      const name = item.fileDiff.name;
      if (meta.kind === "diagnostics") {
        return <DiagnosticsAnnotation diagnostics={meta.diagnostics} />;
      }
      if (meta.kind === "hunk") {
        // A quiet, icon-only revert affordance in the spirit of JetBrains'
        // gutter change markers — right-aligned, minimal vertical footprint.
        // The icon alone is ambiguous, so a tooltip spells out the action.
        return (
          // em units so the control scales with the diff's own font size.
          <div className="flex justify-end px-[0.6em] py-[0.2em]">
            <Tooltip>
              <TooltipTrigger
                aria-label="Discard hunk"
                className="flex items-center justify-center rounded p-[0.3em] text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                render={
                  <button
                    type="button"
                    onClick={() => onDiscardHunk?.(name, meta.hunkIndex)}
                  />
                }
              >
                <IconArrowBackUp className="size-[1.3em]" />
              </TooltipTrigger>
              <TooltipContent side="left">
                Discard this change — revert the hunk to the last commit
              </TooltipContent>
            </Tooltip>
          </div>
        );
      }
      if (meta.kind === "draft") {
        return (
          <DraftCard
            onCancel={onDraftCancel}
            {...(meta.body === undefined ? {} : { initialBody: meta.body })}
            onSubmit={(body) =>
              onCommentSubmit(
                {
                  filePath: name,
                  side: annotation.side,
                  lineNumber: annotation.lineNumber,
                },
                body
              )
            }
          />
        );
      }
      return (
        <CommentThread
          comments={meta.comments}
          onDelete={onCommentDelete}
          onEdit={onCommentEdit}
          onReply={onCommentReply}
        />
      );
    }
  );

  // Both of these have the working tree on their new side, which is the file
  // the language server actually has open.
  const languageEnabled =
    target.kind === "worktree" || target.kind === "branch";

  if (loading) {
    return (
      <div className="p-8">
        <Orb size={16} label="Loading diff…" />
      </div>
    );
  }
  if (error !== null) {
    return <div className="p-8 text-sm text-destructive">{error}</div>;
  }
  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Nothing to review</div>
        <div className="text-muted-foreground">{emptyHint(target)}</div>
      </div>
    );
  }

  return (
    // One CodeView for the whole diff: it owns the scroll, lays every file
    // out from estimated line heights it corrects as they render, and keeps
    // only the files in and around the viewport in the DOM — the wrapper div
    // is here to be measured for the layout above.
    <div ref={containerRef} className="h-full">
      <CodeView<AnnotationMeta, undefined>
        ref={viewerRef}
        className="diff-pane h-full overflow-auto"
        items={items}
        selectedLines={selectedLines}
        options={options}
        onScroll={trackFileInView}
        renderHeaderMetadata={renderHeaderMetadata}
        renderAnnotation={renderAnnotation}
      />
      {items.map((item) => (
        <FileLanguage
          key={item.id}
          path={item.fileDiff.name}
          itemId={item.id}
          element={elements.get(item.id) ?? null}
          enabled={languageEnabled}
          drafting={draft !== null && draft.filePath === item.fileDiff.name}
          register={registerLanguage}
          unregister={unregisterLanguage}
          report={reportDiagnostics}
          onOpenLocation={onOpenLocation}
        />
      ))}
    </div>
  );
}
