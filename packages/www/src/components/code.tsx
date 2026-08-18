import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "extends",
  "false",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "let",
  "new",
  "null",
  "of",
  "readonly",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
]);

type TokenKind =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "call"
  | "type"
  | "punctuation"
  | "plain";

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "text-[#6e7781] italic dark:text-[#8b949e]",
  string: "text-[#0a3069] dark:text-[#a5d6ff]",
  number: "text-[#0550ae] dark:text-[#79c0ff]",
  keyword: "text-[#cf222e] dark:text-[#ff7b72]",
  call: "text-[#8250df] dark:text-[#d2a8ff]",
  type: "text-[#953800] dark:text-[#ffa657]",
  punctuation: "text-[#57606a] dark:text-[#8b949e]",
  plain: "text-[#24292f] dark:text-[#e6edf3]",
};

const TOKEN_PATTERN =
  /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\w.]*)|([A-Za-z_$][\w$]*)|(\s+)|([^\s])/g;

function identifierKind(name: string, following: string): TokenKind {
  if (KEYWORDS.has(name)) return "keyword";
  if (following.trimStart().startsWith("(")) return "call";
  if (/^[A-Z]/.test(name)) return "type";
  return "plain";
}

function tokenize(source: string): ReactNode {
  const nodes: Array<ReactNode> = [];
  let key = 0;

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const [text, comment, string, number, identifier, whitespace] = match;
    const kind: TokenKind = comment
      ? "comment"
      : string
        ? "string"
        : number
          ? "number"
          : identifier
            ? identifierKind(
                identifier,
                source.slice(match.index + text.length)
              )
            : whitespace
              ? "plain"
              : "punctuation";

    nodes.push(
      <span className={TOKEN_CLASS[kind]} key={key++}>
        {text}
      </span>
    );
  }

  return nodes;
}

export type DiffKind = "context" | "added" | "removed";

export interface CodeLine {
  readonly text: string;
  readonly number?: number;
  readonly kind?: DiffKind;
}

const LINE_CLASS: Record<DiffKind, string> = {
  context: "",
  added: "bg-[#dafbe1] dark:bg-[#3fb950]/12",
  removed: "bg-[#ffebe9] dark:bg-[#f85149]/12",
};

const GUTTER_CLASS: Record<DiffKind, string> = {
  context: "text-neutral-400 dark:text-neutral-600",
  added:
    "bg-[#aceebb]/60 text-[#1a7f37] dark:bg-[#3fb950]/20 dark:text-[#3fb950]",
  removed:
    "bg-[#ffcecb]/70 text-[#cf222e] dark:bg-[#f85149]/20 dark:text-[#f85149]",
};

const DIFF_MARK: Record<DiffKind, string> = {
  context: " ",
  added: "+",
  removed: "−",
};

export function CodeLines({
  lines,
  diff = false,
}: {
  lines: ReadonlyArray<CodeLine>;
  diff?: boolean;
}) {
  return (
    <div className="overflow-x-auto font-mono text-[11px] leading-[1.7] sm:text-xs">
      {lines.map((line, index) => {
        const kind = line.kind ?? "context";
        return (
          <div className={cn("flex", LINE_CLASS[kind])} key={index}>
            {line.number === undefined ? null : (
              <span
                className={cn(
                  "w-9 shrink-0 pr-2 text-right tabular-nums select-none",
                  GUTTER_CLASS[kind]
                )}
              >
                {line.number}
              </span>
            )}
            {diff ? (
              <span
                className={cn(
                  "w-4 shrink-0 select-none",
                  kind === "context"
                    ? "text-neutral-300 dark:text-neutral-700"
                    : GUTTER_CLASS[kind]
                )}
              >
                {DIFF_MARK[kind]}
              </span>
            ) : null}
            <pre className="min-w-0 flex-1 pr-4 whitespace-pre">
              {tokenize(line.text)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

export function codeLines(source: string, startAt = 1): Array<CodeLine> {
  return source.split("\n").map((text, index) => ({
    text,
    number: startAt + index,
  }));
}

export function diffLines(source: string, startAt = 1): Array<CodeLine> {
  let number = startAt;
  return source.split("\n").map((raw) => {
    const kind: DiffKind = raw.startsWith("+")
      ? "added"
      : raw.startsWith("-")
        ? "removed"
        : "context";
    const line = { text: raw.slice(1), number, kind };
    if (kind !== "removed") number += 1;
    return line;
  });
}
