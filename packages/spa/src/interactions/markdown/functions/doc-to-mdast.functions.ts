/**
 * The edited document, read back as a markdown syntax tree.
 *
 * The inverse of `mdastToDoc`, and the half that has to be careful: this is
 * what gets written to the file. Two things it takes trouble over.
 *
 * Marks have to be re-nested. ProseMirror has no inline tree — emphasis inside
 * a link is one text node wearing two marks — so the flat runs are grouped back
 * into the nesting markdown needs, and adjacent runs wearing the same marks are
 * merged first, or `**a**` and `**b**` side by side would be written as
 * `**a****b**` and read back as something else.
 *
 * Blocks kept verbatim are handed back as raw output, byte for byte. A file
 * whose HTML or footnotes we could not draw is still a file whose HTML and
 * footnotes must survive being saved.
 */
import type {
  BlockContent,
  Heading,
  Html,
  ListItem,
  PhrasingContent,
  Root,
  TableRow,
} from "mdast";
import type {
  CellAlign,
  DocMark,
  DocNode,
} from "../interfaces/markdown.interfaces";

const childrenOf = (node: DocNode): DocNode[] => node.content ?? [];

const attr = <T>(node: DocNode, name: string): T | undefined =>
  node.attrs?.[name] as T | undefined;

const sameMarks = (a: DocMark[], b: DocMark[]): boolean =>
  a.length === b.length &&
  a.every(
    (mark, index) =>
      mark.type === b[index]?.type &&
      JSON.stringify(mark.attrs ?? null) ===
        JSON.stringify(b[index]?.attrs ?? null)
  );

/**
 * Adjacent text wearing identical marks, joined into one run.
 *
 * The editor splits a run whenever its own bookkeeping needs to; markdown has
 * no way to write the split and would fuse the two emphases into a third thing
 * if asked to try.
 */
function mergedRuns(nodes: ReadonlyArray<DocNode>): DocNode[] {
  const out: DocNode[] = [];
  for (const node of nodes) {
    const previous = out[out.length - 1];
    if (
      node.type === "text" &&
      previous?.type === "text" &&
      sameMarks(previous.marks ?? [], node.marks ?? [])
    ) {
      out[out.length - 1] = {
        ...previous,
        text: (previous.text ?? "") + (node.text ?? ""),
      };
      continue;
    }
    out.push(node);
  }
  return out;
}

/** One run of text, wrapped back into the marks it was wearing, innermost last. */
function markedText(
  value: string,
  marks: ReadonlyArray<DocMark>
): PhrasingContent {
  let node: PhrasingContent = { type: "text", value };
  for (let index = marks.length - 1; index >= 0; index--) {
    const mark = marks[index];
    switch (mark.type) {
      case "bold":
        node = { type: "strong", children: [node] };
        break;
      case "italic":
        node = { type: "emphasis", children: [node] };
        break;
      case "strike":
        node = { type: "delete", children: [node] };
        break;
      case "code":
        // Code spans hold characters, not nodes. Anything already wrapped
        // inside one cannot be expressed in markdown, so its text stands.
        node = { type: "inlineCode", value: phrasingText(node) };
        break;
      case "link":
        node = {
          type: "link",
          url: String(mark.attrs?.href ?? ""),
          title: (mark.attrs?.title as string | null) ?? null,
          children: [node],
        };
        break;
      default:
        break;
    }
  }
  return node;
}

/** The plain characters of a phrasing node, for the places markdown needs them. */
function phrasingText(node: PhrasingContent): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return "children" in node ? node.children.map(phrasingText).join("") : "";
}

function inlineContent(nodes: ReadonlyArray<DocNode>): PhrasingContent[] {
  return mergedRuns(nodes).flatMap((node): PhrasingContent[] => {
    switch (node.type) {
      case "text":
        return node.text === undefined || node.text === ""
          ? []
          : [markedText(node.text, node.marks ?? [])];
      case "hardBreak":
        return [{ type: "break" }];
      case "image":
        return [
          {
            type: "image",
            url: String(attr<string>(node, "src") ?? ""),
            alt: attr<string | null>(node, "alt") ?? null,
            title: attr<string | null>(node, "title") ?? null,
          },
        ];
      default:
        return [];
    }
  });
}

const rawHtml = (node: DocNode): Html => ({
  type: "html",
  value: String(attr<string>(node, "source") ?? ""),
});

/** The column alignments a GFM table writes in its delimiter row. */
function alignmentsOf(table: DocNode): CellAlign[] {
  const headerRow = childrenOf(table)[0];
  return childrenOf(headerRow ?? { type: "tableRow" }).map(
    (cell) => attr<CellAlign>(cell, "align") ?? null
  );
}

function tableRowOf(row: DocNode): TableRow {
  return {
    type: "tableRow",
    children: childrenOf(row).map((cell) => ({
      type: "tableCell",
      // A cell wraps its text in a paragraph in ProseMirror and holds it
      // directly in markdown, so the wrapper is unwound here.
      children: inlineContent(childrenOf(childrenOf(cell)[0] ?? cell)),
    })),
  };
}

function listItemsOf(
  list: DocNode,
  checked: (item: DocNode) => boolean | null
): ListItem[] {
  return childrenOf(list).map((item) => ({
    type: "listItem",
    checked: checked(item),
    spread: false,
    children: blockContent(childrenOf(item)),
  }));
}

function blockContent(nodes: ReadonlyArray<DocNode>): BlockContent[] {
  return nodes.flatMap((node): BlockContent[] => {
    switch (node.type) {
      case "paragraph": {
        // Markdown cannot write an empty paragraph, and the editor makes them
        // freely — the trailing block that lets you click below a table, the
        // one a fresh document opens on. Writing them out as blank lines would
        // grow the file by one every time it was opened.
        const children = inlineContent(childrenOf(node));
        return children.length === 0 ? [] : [{ type: "paragraph", children }];
      }
      case "heading":
        return [
          {
            type: "heading",
            depth: (attr<number>(node, "level") ?? 1) as Heading["depth"],
            children: inlineContent(childrenOf(node)),
          },
        ];
      case "blockquote":
        return [
          { type: "blockquote", children: blockContent(childrenOf(node)) },
        ];
      case "bulletList":
        return [
          {
            type: "list",
            ordered: false,
            spread: false,
            children: listItemsOf(node, () => null),
          },
        ];
      case "orderedList":
        return [
          {
            type: "list",
            ordered: true,
            start: attr<number>(node, "start") ?? 1,
            spread: false,
            children: listItemsOf(node, () => null),
          },
        ];
      case "taskList":
        return [
          {
            type: "list",
            ordered: false,
            spread: false,
            children: listItemsOf(
              node,
              (item) => attr<boolean>(item, "checked") ?? false
            ),
          },
        ];
      case "codeBlock":
        return [
          {
            type: "code",
            lang: attr<string | null>(node, "language") ?? null,
            meta: attr<string | null>(node, "meta") ?? null,
            value: childrenOf(node)
              .map((child) => child.text ?? "")
              .join(""),
          },
        ];
      case "horizontalRule":
        return [{ type: "thematicBreak" }];
      case "table":
        return [
          {
            type: "table",
            align: alignmentsOf(node),
            children: childrenOf(node).map(tableRowOf),
          },
        ];
      case "markdownBlock":
        return [rawHtml(node)];
      default:
        return [];
    }
  });
}

export function docToMdast(doc: DocNode): Root {
  return { type: "root", children: blockContent(childrenOf(doc)) };
}
