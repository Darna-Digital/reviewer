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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LineAnnotation, TokenEventBase } from "@pierre/diffs"
import type { Editor } from "@pierre/diffs/editor"
import type { Diagnostic, FileEdits, Location } from "@byconvo/core/language"
import {
  useDiagnostics,
  useLanguageActions,
} from "../adapters/language.hook.adapter"
import { paintDiagnostics } from "../functions/diagnostic-markers"
import { DIAGNOSTIC_CSS } from "../functions/diagnostic-styles"
import {
  countDiagnostics,
  groupDiagnosticsByLine,
  identifierWithin,
} from "../functions/language.functions"
import type {
  DiagnosticCounts,
  NavigationOutcome,
  TokenSpan,
} from "../interfaces/language.interfaces"
import type { Rect } from "@/lib/floating-placement"
import { SymbolCard } from "./symbol-card"
import { useCompletions } from "./use-completions"
import { useSymbolMenu } from "./use-symbol-menu"
import {
  CardSpinner,
  HoverDocumentation,
  TargetChoice,
  UsagesList,
} from "./symbol-overlay"

/** How long the pointer must rest on a token before documentation is fetched. */
const HOVER_DELAY_MS = 350
/** Grace period so the pointer can travel from the token into the card. */
const HOVER_CLOSE_MS = 150

/** Annotation payload this layer contributes to a view's line annotations. */
export interface DiagnosticsAnnotationMeta {
  readonly kind: "diagnostics"
  readonly diagnostics: ReadonlyArray<Diagnostic>
}

type CardState =
  | {
      readonly kind: "hover"
      readonly anchor: Rect
      readonly contents: string | null
    }
  | { readonly kind: "busy"; readonly anchor: Rect }
  | {
      readonly kind: "outcome"
      readonly anchor: Rect
      readonly outcome: NavigationOutcome
    }

const rectOf = (element: HTMLElement): Rect => {
  const { top, bottom, left } = element.getBoundingClientRect()
  return { top, bottom, left }
}

/** The symbol a token event is about, or null when it is not about one. */
const spanOf = (props: TokenEventBase): TokenSpan | null =>
  identifierWithin({
    lineNumber: props.lineNumber,
    lineCharStart: props.lineCharStart,
    lineCharEnd: props.lineCharEnd,
    tokenText: props.tokenText,
  })

export interface LanguageLayerOptions {
  /** Repository-relative path of the file on screen. */
  path: string
  /** The view's editor, which owns the buffer and the caret. */
  editor: Editor<undefined>
  /** Buffer-change subscription owned by the editing hook. */
  subscribe: (listener: () => void) => () => void
  /** Resolves the element the rendered code lives under. */
  getContainer: () => ParentNode | null
  /** Apply edits landing in files other than the open one. */
  onApplyForeignEdits: (edits: ReadonlyArray<FileEdits>) => void
  /** Unsaved buffer to analyse, or null to analyse the file on disk. */
  contents?: string | null
  /** Turn the whole layer off — no requests, no marks, no card. */
  enabled?: boolean
  /** Open a location the user picked from the card. */
  onOpenLocation: (location: Location) => void
}

export interface LanguageLayer {
  readonly diagnostics: ReadonlyArray<Diagnostic>
  readonly counts: DiagnosticCounts
  /** Diagnostic annotations to merge into the view's `lineAnnotations`. */
  readonly annotations: ReadonlyArray<LineAnnotation<DiagnosticsAnnotationMeta>>
  /** Spread into the view's `options`. */
  readonly viewOptions: {
    readonly useTokenTransformer: boolean
    readonly unsafeCSS: string
    readonly onPostRender: (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => void
    readonly onTokenEnter: (props: TokenEventBase) => void
    readonly onTokenLeave: () => void
    readonly onTokenClick: (props: TokenEventBase, event: MouseEvent) => void
  }
  /** Render alongside the view. */
  readonly card: React.ReactNode
  /** The completion list, when one is open. */
  readonly completions: React.ReactNode
  /** The right-click menu, when one is open. */
  readonly menu: React.ReactNode
}

export function useLanguageLayer({
  path,
  editor,
  subscribe,
  getContainer,
  onApplyForeignEdits,
  contents = null,
  enabled = true,
  onOpenLocation,
}: LanguageLayerOptions): LanguageLayer {
  const query = useDiagnostics(enabled ? path : null, contents)
  const diagnostics = useMemo<ReadonlyArray<Diagnostic>>(
    () => query.data?.diagnostics ?? [],
    [query.data]
  )
  const actions = useLanguageActions(diagnostics)

  const [card, setCard] = useState<CardState | null>(null)

  // The container the view last rendered into, so diagnostics arriving after a
  // render still get painted without waiting for the next one.
  const containerRef = useRef<HTMLElement | null>(null)
  const diagnosticsRef = useRef(diagnostics)
  diagnosticsRef.current = diagnostics

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Guards against a slow response for a token the pointer already left. */
  const hoverToken = useRef<TokenSpan | null>(null)

  const clearTimers = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    hoverTimer.current = null
    closeTimer.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const onPostRender = useCallback(
    (node: HTMLElement, _instance: unknown, phase: string) => {
      if (phase === "unmount") {
        containerRef.current = null
        return
      }
      containerRef.current = node
      paintDiagnostics(node, diagnosticsRef.current)
    },
    []
  )

  useEffect(() => {
    if (containerRef.current !== null) {
      paintDiagnostics(containerRef.current, diagnostics)
    }
  }, [diagnostics])

  const closeCard = useCallback(() => {
    clearTimers()
    hoverToken.current = null
    setCard(null)
  }, [clearTimers])

  const onTokenEnter = useCallback(
    (props: TokenEventBase) => {
      const token = spanOf(props)
      if (token === null) return
      clearTimers()
      const anchor = rectOf(props.tokenElement)
      hoverTimer.current = setTimeout(() => {
        hoverToken.current = token
        setCard((current) =>
          current !== null && current.kind !== "hover"
            ? current
            : { kind: "hover", anchor, contents: null }
        )
        void actions
          .describe(path, token)
          .then((result) => {
            if (hoverToken.current !== token) return
            if (result.contents.trim().length === 0) {
              setCard((current) => (current?.kind === "hover" ? null : current))
              return
            }
            setCard((current) =>
              current?.kind === "hover"
                ? { kind: "hover", anchor, contents: result.contents }
                : current
            )
          })
          .catch(() => {
            setCard((current) => (current?.kind === "hover" ? null : current))
          })
      }, HOVER_DELAY_MS)
    },
    [actions, clearTimers, path]
  )

  const onTokenLeave = useCallback(() => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    closeTimer.current = setTimeout(() => {
      hoverToken.current = null
      setCard((current) => (current?.kind === "hover" ? null : current))
    }, HOVER_CLOSE_MS)
  }, [])

  const onTokenClick = useCallback(
    (props: TokenEventBase, event: MouseEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const token = spanOf(props)
      if (token === null) return
      event.preventDefault()
      clearTimers()
      hoverToken.current = null

      const anchor = rectOf(props.tokenElement)
      setCard({ kind: "busy", anchor })
      void actions
        .navigate(path, token)
        .then((outcome) => {
          // A single destination needs no card; just go there.
          if (outcome.kind === "open") {
            setCard(null)
            onOpenLocation(outcome.target.location)
            return
          }
          if (outcome.kind === "none") {
            setCard(null)
            return
          }
          setCard({ kind: "outcome", anchor, outcome })
        })
        .catch(() => setCard(null))
    },
    [actions, clearTimers, onOpenLocation, path]
  )

  const annotations = useMemo(() => {
    if (!enabled) return []
    return [...groupDiagnosticsByLine(diagnostics)].map(
      ([lineNumber, lineDiagnostics]) => ({
        lineNumber,
        metadata: {
          kind: "diagnostics" as const,
          diagnostics: lineDiagnostics,
        },
      })
    )
  }, [diagnostics, enabled])

  const openFromCard = useCallback(
    (location: Location) => {
      setCard(null)
      onOpenLocation(location)
    },
    [onOpenLocation]
  )

  // Right-click: usages, definition, and the fixes at that spot.
  const symbolMenu = useSymbolMenu({
    editor,
    path,
    enabled,
    getContainer,
    onFindUsages: useCallback(
      (token: TokenSpan, anchor: Rect) => {
        setCard({ kind: "busy", anchor })
        void actions
          .references(path, token)
          .then((outcome) =>
            setCard(
              outcome.kind === "none"
                ? null
                : { kind: "outcome", anchor, outcome }
            )
          )
          .catch(() => setCard(null))
      },
      [actions, path]
    ),
    onGoToDefinition: useCallback(
      (token: TokenSpan, anchor: Rect) => {
        setCard({ kind: "busy", anchor })
        void actions
          .navigate(path, token)
          .then((outcome) => {
            if (outcome.kind === "open") {
              setCard(null)
              onOpenLocation(outcome.target.location)
              return
            }
            setCard(
              outcome.kind === "none"
                ? null
                : { kind: "outcome", anchor, outcome }
            )
          })
          .catch(() => setCard(null))
      },
      [actions, onOpenLocation, path]
    ),
    onApplyForeignEdits,
  })

  const completions = useCompletions({
    editor,
    subscribe,
    path,
    enabled,
    getContainer,
  })

  const cardNode = useMemo(() => {
    if (card === null) return null
    const body =
      card.kind === "busy" ? (
        <CardSpinner label="Resolving…" />
      ) : card.kind === "hover" ? (
        card.contents === null ? (
          <CardSpinner label="Reading…" />
        ) : (
          <HoverDocumentation contents={card.contents} />
        )
      ) : card.outcome.kind === "usages" ? (
        <UsagesList
          symbol={card.outcome.symbol}
          references={card.outcome.references}
          onOpen={openFromCard}
        />
      ) : card.outcome.kind === "choose" ? (
        <TargetChoice targets={card.outcome.targets} onOpen={openFromCard} />
      ) : null

    return (
      <SymbolCard
        anchor={card.anchor}
        onClose={closeCard}
        dismissible={card.kind === "outcome"}
        // Keep a hover card open while the pointer travels into it, so its
        // contents can be read and selected.
        onPointerEnter={clearTimers}
        onPointerLeave={card.kind === "hover" ? closeCard : undefined}
      >
        {body}
      </SymbolCard>
    )
  }, [card, clearTimers, closeCard, openFromCard])

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
  }
}
