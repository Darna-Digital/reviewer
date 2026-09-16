/**
 * The block that carries markdown we chose not to model.
 *
 * Embedded HTML, a link definition, a footnote, the YAML header: constructs a
 * document editor has no shape for, and which a document editor must therefore
 * not touch. The node holds the exact characters it was built from and writes
 * them back unchanged, so the parts of a file the rich editor cannot draw
 * survive being opened and saved by it.
 *
 * It is still editable, as a plain text box. A frontmatter title is one of the
 * things people most often open a document to change, and sending them to the
 * source pane for it would make the editor feel like a viewer.
 */
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import type { RawBlockKind } from "../interfaces/markdown.interfaces";

function RawMarkdownView({ node, updateAttributes, editor }: NodeViewProps) {
  const source = String(node.attrs.source ?? "");
  const kind = String(node.attrs.kind ?? "raw") as RawBlockKind;

  return (
    <NodeViewWrapper
      // The box owns its own editing; ProseMirror must not treat what is typed
      // in the textarea as text entered into the document.
      contentEditable={false}
      data-markdown-block={kind}
      className="my-2 rounded-md border border-dashed bg-muted/40"
    >
      <div className="flex items-center justify-between px-2 pt-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
        <span>{kind === "frontmatter" ? "Frontmatter" : "Raw markdown"}</span>
      </div>
      <textarea
        value={source}
        readOnly={!editor.isEditable}
        spellCheck={false}
        rows={Math.min(source.split("\n").length, 16)}
        onChange={(event) => updateAttributes({ source: event.target.value })}
        className="w-full resize-none bg-transparent px-2 pb-2 font-mono text-xs leading-5 text-foreground outline-none"
      />
    </NodeViewWrapper>
  );
}

export const MarkdownBlock = Node.create({
  name: "markdownBlock",
  group: "block",
  // Atomic: its content is characters we pass through, not a subtree the
  // schema should let the caret wander into.
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      source: { default: "" },
      kind: { default: "raw" as RawBlockKind },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-markdown-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-markdown-block": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RawMarkdownView);
  },
});
