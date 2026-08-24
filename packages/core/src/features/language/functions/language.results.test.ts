import { describe, expect, it } from "vitest";
import type {
  Diagnostic,
  DiagnosticSeverity,
  SymbolReference,
  SymbolTarget,
} from "../schema/language.schema.ts";
import {
  MAX_DIAGNOSTICS,
  MAX_REFERENCES,
  normalizeDiagnostics,
  normalizeReferences,
  normalizeTargets,
} from "./language.results.ts";

const at = (line: number, character = 0, endCharacter = character + 1) => ({
  start: { line, character },
  end: { line, character: endCharacter },
});

const diagnostic = (
  line: number,
  severity: DiagnosticSeverity,
  message = `problem ${line}`
): Diagnostic => ({
  range: at(line),
  severity,
  code: "2322",
  source: "ts",
  message,
  tags: [],
  related: [],
});

const reference = (
  path: string,
  line: number,
  kind: SymbolReference["kind"] = "read"
): SymbolReference => ({
  location: { path, range: at(line) },
  kind,
  preview: "",
  containerName: "",
  containerKind: "",
});

const target = (path: string, line: number): SymbolTarget => ({
  location: { path, range: at(line) },
  name: "greet",
  kind: "function",
  containerName: "",
  preview: "",
});

describe("normalizeDiagnostics", () => {
  it("sorts by position", () => {
    const sorted = normalizeDiagnostics([
      diagnostic(5, "warning"),
      diagnostic(1, "warning"),
      diagnostic(3, "warning"),
    ]);
    expect(sorted.map((d) => d.range.start.line)).toEqual([1, 3, 5]);
  });
  it("puts the more severe diagnostic first at the same position", () => {
    const sorted = normalizeDiagnostics([
      diagnostic(2, "hint", "a"),
      diagnostic(2, "error", "b"),
      diagnostic(2, "warning", "c"),
    ]);
    expect(sorted.map((d) => d.severity)).toEqual(["error", "warning", "hint"]);
  });
  it("drops exact duplicates", () => {
    const one = diagnostic(1, "error");
    expect(normalizeDiagnostics([one, { ...one }])).toHaveLength(1);
  });
  it("keeps diagnostics that differ only by message", () => {
    expect(
      normalizeDiagnostics([
        diagnostic(1, "error", "first"),
        diagnostic(1, "error", "second"),
      ])
    ).toHaveLength(2);
  });
  it("caps the payload", () => {
    const many = Array.from({ length: MAX_DIAGNOSTICS + 50 }, (_, i) =>
      diagnostic(i, "warning")
    );
    const capped = normalizeDiagnostics(many);
    expect(capped).toHaveLength(MAX_DIAGNOSTICS);
    // The cap keeps the earliest lines, not an arbitrary slice of the input.
    expect(capped[0].range.start.line).toBe(0);
  });
  it("does not mutate its input", () => {
    const input = [diagnostic(3, "error"), diagnostic(1, "error")];
    normalizeDiagnostics(input);
    expect(input[0].range.start.line).toBe(3);
  });
});

describe("normalizeReferences", () => {
  it("sorts by path then position", () => {
    const sorted = normalizeReferences([
      reference("b.ts", 1),
      reference("a.ts", 9),
      reference("a.ts", 2),
    ]);
    expect(
      sorted.map((r) => `${r.location.path}:${r.location.range.start.line}`)
    ).toEqual(["a.ts:2", "a.ts:9", "b.ts:1"]);
  });
  it("keeps the most specific kind for a duplicated location", () => {
    const merged = normalizeReferences([
      reference("a.ts", 1, "write"),
      reference("a.ts", 1, "definition"),
      reference("a.ts", 1, "read"),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("definition");
  });
  it("caps the payload", () => {
    const many = Array.from({ length: MAX_REFERENCES + 10 }, (_, i) =>
      reference("a.ts", i)
    );
    expect(normalizeReferences(many)).toHaveLength(MAX_REFERENCES);
  });
  it("handles an empty list", () => {
    expect(normalizeReferences([])).toEqual([]);
  });
});

describe("normalizeTargets", () => {
  it("deduplicates by location and sorts", () => {
    const targets = normalizeTargets([
      target("b.ts", 4),
      target("a.ts", 1),
      target("a.ts", 1),
    ]);
    expect(targets).toHaveLength(2);
    expect(targets[0].location.path).toBe("a.ts");
  });
});
