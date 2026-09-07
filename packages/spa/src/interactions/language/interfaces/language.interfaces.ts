/**
 * `language` feature — the IDE layer over a file view: inline diagnostics,
 * go-to-definition and find-usages.
 *
 * The orchestration worth isolating is the part that decides *what a click
 * means*. Clicking a usage should jump to its declaration; clicking the
 * declaration itself should send its usages to the Find window; several
 * candidates should offer a choice. That rule set is pure logic over injected
 * API calls, so it can be tested without a rendered editor.
 *
 * Coordinates are the one real hazard here. `@pierre/diffs` reports one-based
 * line numbers with zero-based columns; LSP is zero-based on both axes. The
 * conversion happens once, in `positionOfToken`, and nowhere else.
 */
import type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  HoverResult,
  Position,
  SymbolTarget,
} from "@reviewer/core/language";

/** A token as `@pierre/diffs` reports it, without its DOM element. */
export interface TokenSpan {
  /** One-based, as the editor displays it. */
  readonly lineNumber: number;
  /** Zero-based column of the token's first character. */
  readonly lineCharStart: number;
  /** Zero-based column just past the token's last character. */
  readonly lineCharEnd: number;
  readonly tokenText: string;
}

/** Why a token is marked, and what to say about it on hover. */
export interface DiagnosticMarker {
  readonly severity: DiagnosticSeverity;
  readonly tags: ReadonlyArray<DiagnosticTag>;
  /** Every diagnostic touching the token, most severe first. */
  readonly diagnostics: ReadonlyArray<Diagnostic>;
}

export interface DiagnosticCounts {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly hints: number;
}

/** What clicking a token resolved to. */
export type NavigationOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "open"; readonly target: SymbolTarget }
  | { readonly kind: "choose"; readonly targets: ReadonlyArray<SymbolTarget> }
  /**
   * The click landed on the declaration itself, so the useful answer is where
   * the symbol is used. The usages are not fetched here: they belong to the
   * Find window, which owns the request, keeps the results and can say what it
   * is doing while they arrive — so this is the question, not the answer.
   */
  | {
      readonly kind: "usages";
      readonly position: Position;
      readonly symbol: string;
    };

export interface LanguageDependencies {
  data: {
    /** Diagnostics for the file on screen. */
    readonly diagnostics: ReadonlyArray<Diagnostic>;
  };
  sideEffects: {
    readonly definition: (
      path: string,
      position: Position
    ) => Promise<{
      readonly targets: ReadonlyArray<SymbolTarget>;
    }>;
    readonly hover: (path: string, position: Position) => Promise<HoverResult>;
  };
}

export interface LanguageFunctions {
  /** Diagnostics keyed by the one-based line their range starts on. */
  readonly diagnosticsByLine: () => ReadonlyMap<
    number,
    ReadonlyArray<Diagnostic>
  >;
  /** How to mark `token`, or null when no diagnostic touches it. */
  readonly markerFor: (token: TokenSpan) => DiagnosticMarker | null;
  readonly counts: () => DiagnosticCounts;
  readonly navigate: (
    path: string,
    token: TokenSpan
  ) => Promise<NavigationOutcome>;
  readonly describe: (path: string, token: TokenSpan) => Promise<HoverResult>;
}
