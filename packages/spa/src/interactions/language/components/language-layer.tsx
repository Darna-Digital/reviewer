/**
 * The IDE layer for a file view, packaged as one hook.
 *
 * It owns everything that has to talk to `@pierre/diffs`: the token hooks that
 * turn a pointer into an LSP position, the post-render pass that underlines
 * problem tokens, the per-line diagnostic annotations, and the floating card.
 * A view adopts all of it by spreading `viewOptions` into its options and
 * rendering `card`; nothing else about the view has to change.
 *
 * Navigation is modifier-click, as in a JetBrains IDE. Plain clicks belong to
 * text selection — hijacking them would make the file impossible to copy from.
 *
 * Anything that answers with a *list* leaves here: find-usages opens the Find
 * window in the dock rather than a card over the token. A card is the wrong
 * shape for it — it holds a dozen rows, has no room for the code around them,
 * and is gone the moment you look away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LineAnnotation, TokenEventBase } from "@pierre/diffs";
import type { Editor } from "@pierre/diffs/edit";
import type { Diagnostic, FileEdits, Location } from "@byconvo/core/language";
import {
  forgetHovers,
  useDiagnostics,
  useLanguageActions,
} from "../adapters/language.hook.adapter";
import { paintDiagnostics } from "../functions/diagnostic-markers";
import { DIAGNOSTIC_CSS } from "../functions/diagnostic-styles";
import {
  countDiagnostics,
  groupDiagnosticsByLine,
  identifierWithin,
  positionOfToken,
} from "../functions/language.functions";
import type {
  DiagnosticCounts,
  NavigationOutcome,
  TokenSpan,
} from "../interfaces/language.interfaces";
import {
  isLiveAnchor,
  rectAnchor,
  type VirtualAnchor,
} from "../functions/anchors";
import { findUsages } from "@/interactions/find-usages/adapters/find-usages.store";
import { SymbolCard } from "./symbol-card";
import { useCompletions } from "./use-completions";
import { useSymbolMenu } from "./use-symbol-menu";
import {
  CardSpinner,
  HoverDocumentation,
  TargetChoice,
} from "./symbol-overlay";

/** How long the pointer must rest on a token before documentation is fetched. */
const HOVER_DELAY_MS = 350;
/** Grace period so the pointer can travel from the token into the card. */
const HOVER_CLOSE_MS = 150;

/** Annotation payload this layer contributes to a view's line annotations. */
export interface DiagnosticsAnnotationMeta {
  readonly kind: "diagnostics";
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

/**
 * What a card hangs off. The token element itself while it is still in the
 * document, so the card rides along as the view scrolls; a frozen copy of its
 * rectangle once the virtualiser has recycled it, which at least leaves the
 * card where the user last saw it instead of in the corner of the screen.
 */
type CardAnchor = () => Element | VirtualAnchor;

const anchorFor = (element: HTMLElement): CardAnchor => {
  const frozen = rectAnchor(element.getBoundingClientRect());
  return () => (isLiveAnchor(element) ? element : frozen);
};

type CardState =
  | {
      readonly kind: "hover";
      readonly anchor: CardAnchor;
      readonly contents: string | null;
    }
  | { readonly kind: "busy"; readonly anchor: CardAnchor }
  /**
   * A choice of declarations — the one outcome that is still a card. It is a
   * short list the user picks from and is done with, drawn over the token it is
   * about; usages are a surface you stay on, and they go to the Find window.
   */
  | {
      readonly kind: "outcome";
      readonly anchor: CardAnchor;
      readonly outcome: NavigationOutcome;
    };

/** The symbol a token event is about, or null when it is not about one. */
const spanOf = (props: TokenEventBase): TokenSpan | null =>
  identifierWithin({
    lineNumber: props.lineNumber,
    lineCharStart: props.lineCharStart,
    lineCharEnd: props.lineCharEnd,
    tokenText: props.tokenText,
  });

export interface LanguageLayerOptions {
  /** Repository-relative path of the file on screen. */
  path: string;
  /**
   * The view's editor, which owns the buffer and the caret — or null for a
   * read-only view. Without one there is nothing to type into and nothing to
   * apply a fix to, so completions and the quick-fix menu stay off; hover and
   * navigation are read-only questions and work either way.
   */
  editor: Editor<"file"> | null;
  /** Buffer-change subscription owned by the editing hook. */
  subscribe?: (listener: () => void) => () => void;
  /**
   * Whether the caret is in the code. The completion list takes Enter, Tab and
   * the arrows while it is open, so it has to know when the keystrokes stopped
   * being meant for the editor.
   */
  isFocused?: () => boolean;
  /**
   * Whether completions should offer themselves at all. Off in Vim's normal and
   * visual modes, where a keystroke is a command rather than a word being typed.
   */
  completionsEnabled?: boolean;
  /** Resolves the element the rendered code lives under. */
  getContainer: () => ParentNode | null;
  /** Apply edits landing in files other than the open one. */
  onApplyForeignEdits?: (edits: ReadonlyArray<FileEdits>) => void;
  /**
   * Whether a line number in the DOM is this file's own line number. False in a
   * diff, where a deletion row carries the line it had in the *other* file — so
   * everything that resolves a position by reading the rendered code, rather
   * than from a token event, has to stay off there: the underlines under
   * problem tokens, and the right-click menu.
   */
  lineNumbersMatchFile?: boolean;
  /** Unsaved buffer to analyse, or null to analyse the file on disk. */
  contents?: string | null;
  /** Turn the whole layer off — no requests, no marks, no card. */
  enabled?: boolean;
  /** Open a location the user picked from the card. */
  onOpenLocation: (location: Location) => void;
}

export interface LanguageLayer {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly counts: DiagnosticCounts;
  /** Diagnostic annotations to merge into the view's `lineAnnotations`. */
  readonly annotations: ReadonlyArray<
    LineAnnotation<DiagnosticsAnnotationMeta>
  >;
  /** Spread into the view's `options`. */
  readonly viewOptions: {
    readonly useTokenTransformer: boolean;
    readonly unsafeCSS: string;
    readonly onPostRender: (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => void;
    readonly onTokenEnter: (props: TokenEventBase) => void;
    readonly onTokenLeave: () => void;
    readonly onTokenClick: (props: TokenEventBase, event: MouseEvent) => void;
  };
  /** Render alongside the view. */
  readonly card: React.ReactNode;
  /** The completion list, when one is open. */
  readonly completions: React.ReactNode;
  /** The right-click menu, when one is open. */
  readonly menu: React.ReactNode;
}

export function useLanguageLayer({
  path,
  editor,
  subscribe,
  isFocused,
  completionsEnabled = true,
  getContainer,
  onApplyForeignEdits,
  contents = null,
  enabled = true,
  lineNumbersMatchFile = true,
  onOpenLocation,
}: LanguageLayerOptions): LanguageLayer {
  // Nothing is asked of the language server until the code is on screen. The
  // first request against a repository builds a whole TypeScript program, and
  // starting that in the same commit as the view puts it between the user and
  // the text they asked for.
  const [painted, setPainted] = useState(false);
  useEffect(() => setPainted(false), [path]);

  const query = useDiagnostics(enabled ? path : null, contents, painted);
  const diagnostics = useMemo<ReadonlyArray<Diagnostic>>(
    () => query.data?.diagnostics ?? [],
    [query.data]
  );
  const actions = useLanguageActions(diagnostics);

  // A file whose contents have moved on has different symbols at the positions
  // the hover cache is keyed by.
  const queryClient = useQueryClient();
  useEffect(() => {
    forgetHovers(queryClient, path);
  }, [contents, path, queryClient]);

  const [card, setCard] = useState<CardState | null>(null);

  // The container the view last rendered into, so diagnostics arriving after a
  // render still get painted without waiting for the next one.
  const containerRef = useRef<HTMLElement | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;
  const paintRef = useRef(lineNumbersMatchFile);
  paintRef.current = lineNumbersMatchFile;

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards against a slow response for a token the pointer already left. */
  const hoverToken = useRef<TokenSpan | null>(null);

  const clearTimers = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    hoverTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const onPostRender = useCallback(
    (node: HTMLElement, _instance: unknown, phase: string) => {
      if (phase === "unmount") {
        containerRef.current = null;
        return;
      }
      containerRef.current = node;
      // The code is in the DOM; let the browser put it on screen before the
      // language server is asked anything. Flipping this synchronously would
      // enqueue the request in the same frame as the paint it is waiting for.
      requestAnimationFrame(() => setPainted(true));
      if (paintRef.current) paintDiagnostics(node, diagnosticsRef.current);
    },
    []
  );

  useEffect(() => {
    if (containerRef.current !== null && lineNumbersMatchFile) {
      paintDiagnostics(containerRef.current, diagnostics);
    }
  }, [diagnostics, lineNumbersMatchFile]);

  const closeCard = useCallback(() => {
    clearTimers();
    hoverToken.current = null;
    setCard(null);
  }, [clearTimers]);

  // Documentation the pointer opened goes away when the view scrolls, as it
  // does in an IDE. Without this it outlives whatever the pointer was over —
  // and a card the user has stopped thinking about still covers the code and
  // swallows the click meant for it. A card the user asked for stays open and
  // rides along with its token instead.
  //
  // Scrolling *inside* the card is the opposite gesture — reading it — and a
  // long signature or doc comment overflows often enough that closing there
  // would make the rest of it unreachable.
  useEffect(() => {
    if (card?.kind !== "hover") return;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-symbol-card]"))
        return;
      closeCard();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [card?.kind, closeCard]);

  // And it goes away as soon as the pointer is somewhere else entirely — the
  // rail, the sidebar, another pane. The token's own leave event only fires
  // while the pointer is still travelling over the code, so a move straight out
  // of it would otherwise leave the card hanging there.
  useEffect(() => {
    if (card?.kind !== "hover") return;
    const onPointerOver = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest("[data-symbol-card]"))
        return;
      const container = getContainer();
      if (container !== null && container.contains(target)) return;
      closeCard();
    };
    window.addEventListener("pointerover", onPointerOver, true);
    return () => window.removeEventListener("pointerover", onPointerOver, true);
  }, [card?.kind, closeCard, getContainer]);

  const onTokenEnter = useCallback(
    (props: TokenEventBase) => {
      const token = spanOf(props);
      if (token === null) return;
      clearTimers();
      const anchor = anchorFor(props.tokenElement);
      hoverTimer.current = setTimeout(() => {
        hoverToken.current = token;
        setCard((current) =>
          current !== null && current.kind !== "hover"
            ? current
            : { kind: "hover", anchor, contents: null }
        );
        void actions
          .describe(path, token)
          .then((result) => {
            if (hoverToken.current !== token) return;
            if (result.contents.trim().length === 0) {
              setCard((current) =>
                current?.kind === "hover" ? null : current
              );
              return;
            }
            setCard((current) =>
              current?.kind === "hover"
                ? { kind: "hover", anchor, contents: result.contents }
                : current
            );
          })
          .catch(() => {
            setCard((current) => (current?.kind === "hover" ? null : current));
          });
      }, HOVER_DELAY_MS);
    },
    [actions, clearTimers, path]
  );

  const onTokenLeave = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    closeTimer.current = setTimeout(() => {
      hoverToken.current = null;
      setCard((current) => (current?.kind === "hover" ? null : current));
    }, HOVER_CLOSE_MS);
  }, []);

  const onTokenClick = useCallback(
    (props: TokenEventBase, event: MouseEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const token = spanOf(props);
      if (token === null) return;
      event.preventDefault();
      clearTimers();
      hoverToken.current = null;

      const anchor = anchorFor(props.tokenElement);
      setCard({ kind: "busy", anchor });
      void actions
        .navigate(path, token)
        .then((outcome) => {
          // Anything with one answer needs no card: a destination is jumped to,
          // and usages go to the window that is built to hold them.
          if (outcome.kind === "open") {
            setCard(null);
            onOpenLocation(outcome.target.location);
            return;
          }
          if (outcome.kind === "usages") {
            setCard(null);
            findUsages(path, outcome.position, outcome.symbol);
            return;
          }
          if (outcome.kind === "none") {
            setCard(null);
            return;
          }
          setCard({ kind: "outcome", anchor, outcome });
        })
        .catch(() => setCard(null));
    },
    [actions, clearTimers, onOpenLocation, path]
  );

  const annotations = useMemo(() => {
    if (!enabled) return [];
    return [...groupDiagnosticsByLine(diagnostics)].map(
      ([lineNumber, lineDiagnostics]) => ({
        lineNumber,
        metadata: {
          kind: "diagnostics" as const,
          diagnostics: lineDiagnostics,
        },
      })
    );
  }, [diagnostics, enabled]);

  const openFromCard = useCallback(
    (location: Location) => {
      setCard(null);
      onOpenLocation(location);
    },
    [onOpenLocation]
  );

  // Right-click: usages, definition, and the fixes at that spot.
  const symbolMenu = useSymbolMenu({
    editor,
    path,
    // The menu finds its symbol by reading the rendered code, so it goes where
    // the line numbers there are this file's own. It does not need a buffer:
    // usages and definition are read-only questions, and the fixes it also
    // carries leave themselves out when there is nothing to apply them to.
    enabled: enabled && lineNumbersMatchFile,
    getContainer,
    onOpen: closeCard,
    // No card and no spinner: the search is handed to the Find window, which
    // opens on the question and says for itself that it is working on it.
    onFindUsages: useCallback(
      (token: TokenSpan) => {
        setCard(null);
        findUsages(path, positionOfToken(token), token.tokenText);
      },
      [path]
    ),
    onGoToDefinition: useCallback(
      (token: TokenSpan, at: VirtualAnchor) => {
        const anchor: CardAnchor = () => at;
        setCard({ kind: "busy", anchor });
        void actions
          .navigate(path, token)
          .then((outcome) => {
            if (outcome.kind === "open") {
              setCard(null);
              onOpenLocation(outcome.target.location);
              return;
            }
            if (outcome.kind === "usages") {
              setCard(null);
              findUsages(path, outcome.position, outcome.symbol);
              return;
            }
            setCard(
              outcome.kind === "none"
                ? null
                : { kind: "outcome", anchor, outcome }
            );
          })
          .catch(() => setCard(null));
      },
      [actions, onOpenLocation, path]
    ),
    onApplyForeignEdits,
  });

  const completions = useCompletions({
    editor,
    subscribe,
    isFocused,
    path,
    enabled: enabled && completionsEnabled && editor !== null,
    getContainer,
  });

  const cardNode = useMemo(() => {
    if (card === null) return null;
    const body =
      card.kind === "busy" ? (
        <CardSpinner label="Resolving…" />
      ) : card.kind === "hover" ? (
        card.contents === null ? (
          <CardSpinner label="Reading…" />
        ) : (
          <HoverDocumentation contents={card.contents} />
        )
      ) : card.outcome.kind === "choose" ? (
        <TargetChoice targets={card.outcome.targets} onOpen={openFromCard} />
      ) : null;

    return (
      <SymbolCard
        anchor={card.anchor}
        onClose={closeCard}
        // A card the user asked for takes focus, so its list is reachable from
        // the keyboard. One the pointer merely passed over must not.
        interactive={card.kind === "outcome"}
        // Keep a hover card open while the pointer travels into it, so its
        // contents can be read and selected.
        onPointerEnter={clearTimers}
        onPointerLeave={card.kind === "hover" ? closeCard : undefined}
      >
        {body}
      </SymbolCard>
    );
  }, [card, clearTimers, closeCard, openFromCard]);

  return {
    diagnostics,
    counts: countDiagnostics(diagnostics),
    completions: completions.popup,
    menu: symbolMenu.menu,
    annotations,
    viewOptions: {
      useTokenTransformer: true,
      // The code lives in a shadow root, so the app stylesheet cannot mark it.
      unsafeCSS: DIAGNOSTIC_CSS,
      onPostRender,
      onTokenEnter,
      onTokenLeave,
      onTokenClick,
    },
    card: cardNode,
  };
}
