/**
 * Taking an LSP hover apart so the card can lay it out instead of dumping it.
 *
 * Every language server answers a hover with one markdown blob, but they all
 * build it the same way: the signature in a fenced block, then the doc comment,
 * then — for the servers that ship reference data, CSS and HTML among them —
 * a trailing link out to the documentation. Rendered as one stream of markdown
 * that reads as a wall: the signature, the prose and the link all arrive at the
 * same weight, and the thing the user hovered to find is somewhere in the
 * middle of it.
 *
 * Splitting it lets the card give each piece its own slot — a heading with the
 * symbol's kind, a panel for the declaration, prose underneath, and the links
 * as a footer row. The signature comes back as bare code, since the panel sets
 * it whole; the body stays markdown, which is what its prose is.
 *
 * Nothing here is language-specific: a hover that does not follow the shape
 * falls through as one body, which is exactly what the card used to render.
 */

export interface HoverLink {
  readonly label: string;
  readonly href: string;
}

export interface HoverParts {
  /**
   * The symbol's kind as the server named it — `method`, `const`, `interface`.
   * Empty when the signature does not announce one.
   */
  readonly kind: string;
  /** The declaration itself, unfenced, ready to set in a panel of its own. */
  readonly signature: string;
  /** The doc comment and its tags — everything the signature is not. */
  readonly body: string;
  /** Documentation links the server appended, lifted out of the prose. */
  readonly links: ReadonlyArray<HoverLink>;
}

/** ```` ```ts ```` … ```` ``` ```` at the very start, or null. */
const leadingFence = (text: string): { code: string; rest: string } | null => {
  const lines = text.split("\n");
  const open = lines[0] ?? "";
  if (!open.startsWith("```")) return null;
  // The info string may name a language (` ```ts `) but must not itself close
  // the fence, which is what an inline ` ```x``` ` would look like here.
  if (open.slice(3).includes("```")) return null;
  const close = lines.findIndex(
    (line, index) => index > 0 && line.trimEnd() === "```"
  );
  if (close === -1) return null;
  return {
    code: lines.slice(1, close).join("\n").trim(),
    rest: lines
      .slice(close + 1)
      .join("\n")
      .trim(),
  };
};

/**
 * TypeScript prefixes a parenthesised kind — `(method) Foo.bar(): void` — and
 * otherwise opens with the declaration keyword. Both name the same thing, and
 * neither is worth repeating in the signature once it is in the heading.
 */
const DECLARATION_KEYWORDS = new Set([
  "class",
  "const",
  "enum",
  "function",
  "import",
  "interface",
  "let",
  "module",
  "namespace",
  "type",
  "var",
]);

const kindOf = (code: string): { kind: string; signature: string } => {
  const lines = code.split("\n");
  const first = (lines[0] ?? "").trim();

  const parenthesised = /^\(([a-z][a-z ]*)\)\s*/.exec(first);
  if (parenthesised !== null) {
    const [matched, kind] = parenthesised;
    const stripped = first.slice(matched.length);
    // A kind on its own carries no signature to strip it from.
    if (stripped.length === 0) return { kind: kind ?? "", signature: code };
    return {
      kind: kind ?? "",
      signature: [stripped, ...lines.slice(1)].join("\n"),
    };
  }

  const keyword = /^([a-z]+)\b/.exec(first)?.[1];
  if (keyword !== undefined && DECLARATION_KEYWORDS.has(keyword)) {
    return { kind: keyword, signature: code };
  }
  return { kind: "", signature: code };
};

/** A paragraph made of nothing but markdown links, in source order. */
const linksOnly = (paragraph: string): ReadonlyArray<HoverLink> | null => {
  const links: Array<HoverLink> = [];
  let rest = paragraph.trim();
  while (rest.length > 0) {
    const match = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (match === null) return null;
    links.push({ label: match[1] ?? "", href: match[2] ?? "" });
    // Servers separate several links with a comma, a pipe or just a space.
    rest = rest.slice(match[0].length).replace(/^[\s,|·—-]+/, "");
  }
  return links.length > 0 ? links : null;
};

export const splitHover = (contents: string): HoverParts => {
  const trimmed = contents.trim();
  const fence = leadingFence(trimmed);
  const { kind, signature } =
    fence === null ? { kind: "", signature: "" } : kindOf(fence.code);

  const paragraphs = (fence === null ? trimmed : fence.rest)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  // Only trailing paragraphs move to the footer: a link in the middle of a doc
  // comment is part of the sentence it sits in.
  const links: Array<HoverLink> = [];
  while (paragraphs.length > 0) {
    const found = linksOnly(paragraphs[paragraphs.length - 1] ?? "");
    if (found === null) break;
    paragraphs.pop();
    links.unshift(...found);
  }

  return { kind, signature, body: paragraphs.join("\n\n"), links };
};
