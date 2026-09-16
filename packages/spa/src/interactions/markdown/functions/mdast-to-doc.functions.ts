/**
 * The markdown syntax tree, read as an editable document.
 *
 * Two rules decide the whole translation. Anything the document model has a
 * block for becomes that block, so it can be edited as a heading or a list
 * rather than as punctuation. Anything it does not — embedded HTML, a link
 * definition, a footnote, the YAML header — is carried through as the exact
 * characters it came from, in a block that hands them back untouched. Nothing
 * is ever dropped: opening a file must not be a way to lose part of it.
 *
 * Soft line breaks inside a paragraph are kept as the newlines they are rather
 * than reflowed into spaces. A hard-wrapped document edited here should come
 * back out wrapped the way its author left it, or every save would rewrite
 * every paragraph and the diff would say nothing.
 */
import type {
  PhrasingContent,
  Root,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";
import type {
  CellAlign,
  DocMark,
  DocNode,
  RawBlockKind,
} from "../interfaces/markdown.interfaces";

/** The source text a node covers, for the blocks that are kept verbatim. */
const sliceOf = (source: string, node: RootContent): string => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? ""
    : source.slice(start, end);
};

const rawBlock = (source: string, kind: RawBlockKind): DocNode => ({
  type: "markdownBlock",
  attrs: { source, kind },
});

const text = (value: string, marks?: DocMark[]): DocNode =>
  marks === undefined || marks.length === 0
    ? { type: "text", text: value }
    : { type: "text", text: value, marks };

const withMark = (marks: DocMark[], mark: DocMark): DocMark[] => [
  ...marks,
  mark,
];

/**
 * Inline content, carrying the marks it is nested in down to the text itself.
 *
 * ProseMirror has no inline tree: emphasis inside a link is one text node
 * wearing two marks, not a node inside a node. The recursion is therefore
 * threaded with the marks accumulated so far rather than returning wrappers.
 */
function inlineNodes(
  nodes: ReadonlyArray<PhrasingContent>,
  source: string,
  marks: DocMark[]
): DocNode[] {
  const out: DocNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (node.value !== "") out.push(text(node.value, marks));
        break;
      case "strong":
        out.push(
          ...inlineNodes(
            node.children,
            source,
            withMark(marks, { type: "bold" })
          )
        );
        break;
      case "emphasis":
        out.push(
          ...inlineNodes(
            node.children,
            source,
            withMark(marks, { type: "italic" })
          )
        );
        break;
      case "delete":
        out.push(
          ...inlineNodes(
            node.children,
            source,
            withMark(marks, { type: "strike" })
          )
        );
        break;
      case "inlineCode":
        out.push(text(node.value, withMark(marks, { type: "code" })));
        break;
      case "link":
        out.push(
          ...inlineNodes(
            node.children,
            source,
            withMark(marks, {
              type: "link",
              attrs: { href: node.url, title: node.title ?? null },
            })
          )
        );
        break;
      case "image":
        out.push({
          type: "image",
          attrs: {
            src: node.url,
            alt: node.alt ?? null,
            title: node.title ?? null,
          },
        });
        break;
      case "break":
        out.push({ type: "hardBreak" });
        break;
      default: {
        // Inline HTML, a reference link, a footnote marker: no mark describes
        // it, so the characters stand as themselves.
        const raw = sliceOf(source, node);
        if (raw !== "") out.push(text(raw, marks));
      }
    }
  }
  return out;
}

const paragraphOf = (
  children: ReadonlyArray<PhrasingContent>,
  source: string
): DocNode => {
  const content = inlineNodes(children, source, []);
  return content.length === 0
    ? { type: "paragraph" }
    : { type: "paragraph", content };
};

/** A GFM table row: the header row becomes header cells, the rest body cells. */
function tableRow(
  row: TableRow,
  align: ReadonlyArray<CellAlign>,
  header: boolean,
  source: string
): DocNode {
  const cells = row.children.map((cell: TableCell, index) => ({
    type: header ? "tableHeader" : "tableCell",
    attrs: { align: align[index] ?? null },
    // A cell holds phrasing content in markdown and block content in
    // ProseMirror, so it gains the paragraph the schema requires.
    content: [paragraphOf(cell.children, source)],
  }));
  return { type: "tableRow", content: cells };
}

/**
 * A markdown list, as the one of three list blocks it actually is.
 *
 * GFM writes a to-do list as a bullet list whose items carry a checkbox, so the
 * checkbox — not the list — is what says which block this is.
 */
function listNode(
  node: Extract<RootContent, { type: "list" }>,
  source: string
): DocNode {
  const isTask = node.children.some((item) => item.checked !== null);
  if (isTask) {
    return {
      type: "taskList",
      content: node.children.map((item) => ({
        type: "taskItem",
        attrs: { checked: item.checked ?? false },
        content: blockNodes(item.children as RootContent[], source),
      })),
    };
  }
  const items = node.children.map((item) => ({
    type: "listItem",
    content: blockNodes(item.children as RootContent[], source),
  }));
  return node.ordered === true
    ? { type: "orderedList", attrs: { start: node.start ?? 1 }, content: items }
    : { type: "bulletList", content: items };
}

function blockNodes(
  nodes: ReadonlyArray<RootContent>,
  source: string
): DocNode[] {
  const out: DocNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        out.push(paragraphOf(node.children, source));
        break;
      case "heading":
        out.push({
          type: "heading",
          attrs: { level: node.depth },
          content: inlineNodes(node.children, source, []),
        });
        break;
      case "blockquote":
        out.push({
          type: "blockquote",
          content: blockNodes(node.children, source),
        });
        break;
      case "list":
        out.push(listNode(node, source));
        break;
      case "code":
        out.push({
          type: "codeBlock",
          attrs: { language: node.lang ?? null, meta: node.meta ?? null },
          content: node.value === "" ? undefined : [text(node.value)],
        });
        break;
      case "thematicBreak":
        out.push({ type: "horizontalRule" });
        break;
      case "table":
        out.push({
          type: "table",
          content: node.children.map((row, index) =>
            tableRow(row, node.align ?? [], index === 0, source)
          ),
        });
        break;
      case "yaml":
        out.push(rawBlock(sliceOf(source, node), "frontmatter"));
        break;
      default:
        // TOML frontmatter is enabled but not in mdast's own node union, so it
        // is recognised by name rather than by the switch.
        out.push(
          rawBlock(
            sliceOf(source, node),
            (node as { type: string }).type === "toml" ? "frontmatter" : "raw"
          )
        );
    }
  }
  return out;
}

/**
 * The document a syntax tree describes.
 *
 * An empty file still opens on a paragraph: ProseMirror's schema requires the
 * document to hold at least one block, and a reader who opens an empty file
 * wants somewhere to start typing.
 */
export function mdastToDoc(root: Root, source: string): DocNode {
  const content = blockNodes(root.children, source);
  return {
    type: "doc",
    content: content.length === 0 ? [{ type: "paragraph" }] : content,
  };
}
