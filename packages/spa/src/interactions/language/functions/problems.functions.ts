/**
 * Pure logic for the problems bar — the expandable strip along the bottom of
 * the editor that lists the open file's diagnostics.
 *
 * The bar reads top-to-bottom as "what to fix first": errors ahead of
 * warnings, and within a severity in file order, so the list mirrors both the
 * urgency and the file. Everything here is a plain function over diagnostics,
 * so the ordering and the labels can be tested without a rendered editor.
 */
import type { Diagnostic, DiagnosticSeverity } from "@reviewer/core/language";
import type { DiagnosticCounts } from "../interfaces/language.interfaces";

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
};

/** Errors first, then down the severities; within one, file order. */
export const orderProblems = (
  diagnostics: ReadonlyArray<Diagnostic>
): ReadonlyArray<Diagnostic> =>
  [...diagnostics].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.range.start.line - b.range.start.line ||
      a.range.start.character - b.range.start.character
  );

/** "12:5" — one-based line and column, as editors print positions. */
export const problemPosition = (diagnostic: Diagnostic): string =>
  `${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1}`;

/** "ts(2322)", or just the source when the diagnostic carries no code. */
export const problemOrigin = (diagnostic: Diagnostic): string =>
  diagnostic.code === null
    ? diagnostic.source
    : `${diagnostic.source}(${diagnostic.code})`;

const count = (value: number, singular: string): string =>
  `${value} ${singular}${value === 1 ? "" : "s"}`;

/**
 * "2 errors, 1 warning" — only what is present, worst first, and "No problems"
 * when the file is clean. The collapsed strip and its accessible name both
 * read from this, so the two can never disagree.
 */
export const problemsLabel = (counts: DiagnosticCounts): string => {
  const parts = [
    counts.errors > 0 ? count(counts.errors, "error") : null,
    counts.warnings > 0 ? count(counts.warnings, "warning") : null,
    counts.infos > 0 ? count(counts.infos, "info") : null,
    counts.hints > 0 ? count(counts.hints, "hint") : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? "No problems" : parts.join(", ");
};
