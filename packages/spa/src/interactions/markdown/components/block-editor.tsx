/**
 * The document editor — markdown in, markdown out, blocks in between.
 *
 * It is a controlled component over *text*, not over a document: the buffer the
 * two panes of a split view share is markdown, so this parses on the way in and
 * serialises on the way out. That is what lets the same file be typed into from
 * either side without either side owning it.
 *
 * Two guards make that safe, and both are necessary.
 *
 * Coming in: every keystroke here produces markdown, which the parent sets as
 * the buffer, which comes straight back as a new `value` — and replacing the
 * document with a re-parse of what the user is currently typing would take the
 * caret to the top of the file on every letter. So the text this editor last
 * settled on is remembered, and a `value` equal to it is recognised as the echo
 * it is. Anything else is a genuine change from outside — the source pane, a
 * reload from disk — and is applied.
 *
 * Going out: merely opening a document produces an update, because ProseMirror
 * normalises what it is given and adds its trailing block. Emitting that would
 * rewrite bullet markers and mark a file dirty that nobody had touched. So the
 * canonical form of what was seeded is kept alongside it, and an update that
 * comes back equal to it is the editor settling rather than the user typing.
 *
 * The block handle is tracked from the container's `mousemove` rather than from
 * each block, because the blocks are ProseMirror's and giving them handlers
 * would mean a node view for every paragraph in the file.
 */
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DOCUMENT_EXTENSIONS } from "../extensions/document-extensions";
import {
  type BlockTarget,
  blockAt,
  blockRect,
  dropBlockAtEnd,
  isDraggingBlock,
} from "../functions/block-handles.functions";
import {
  docToMarkdown,
  markdownToDoc,
} from "../functions/markdown-conversion.functions";
import type { DocNode } from "../interfaces/markdown.interfaces";
import { BlockGutter } from "./block-gutter";

interface HoveredBlock {
  readonly target: BlockTarget;
  /** Offset from the top of the container, in px. */
  readonly top: number;
}

export interface BlockEditorProps {
  /** The markdown this editor is showing. */
  value: string;
  editable?: boolean;
  /** Called with the markdown the document now describes. */
  onChange: (text: string) => void;
  className?: string;
}

export function BlockEditor({
  value,
  editable = true,
  onChange,
  className,
}: BlockEditorProps) {
  const container = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredBlock | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Refs, not state: both have to be current the instant the next `value` or
  // transaction arrives, which is before any render could have committed them.
  /** The markdown this editor is currently showing, as the parent spells it. */
  const showing = useRef<string | null>(null);
  /** The same document as this editor would write it, which is not the same. */
  const canonical = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const initial = useRef<DocNode | null>(null);
  if (initial.current === null) {
    initial.current = markdownToDoc(value);
    showing.current = value;
    canonical.current = docToMarkdown(initial.current);
  }

  const editor = useEditor({
    extensions: DOCUMENT_EXTENSIONS,
    content: initial.current,
    editable,
    // TipTap renders on the server otherwise, and this app hydrates.
    immediatelyRender: false,
    editorProps: { attributes: { class: "document-content outline-none" } },
    onUpdate: ({ editor: instance }) => {
      // Serialising on every keystroke is deliberate: the split view mirrors as
      // you type, and a document large enough for this to cost anything is far
      // larger than markdown files in a repository get.
      const text = docToMarkdown(instance.getJSON() as DocNode);
      if (text === canonical.current) return;
      canonical.current = text;
      showing.current = text;
      onChangeRef.current(text);
    },
  });

  useEffect(() => {
    if (editor === null) return;
    if (value === showing.current) return;
    const doc = markdownToDoc(value);
    showing.current = value;
    canonical.current = docToMarkdown(doc);
    editor.commands.setContent(doc, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  function trackHoveredBlock(event: React.MouseEvent) {
    if (editor === null || menuOpen || !editable) return;

    const target = blockAt(editor.view, event.clientY);
    if (target === null) {
      setHovered(null);
      return;
    }
    if (hovered?.target.pos === target.pos) return;

    const rect = blockRect(editor.view, target);
    const bounds = container.current?.getBoundingClientRect();
    setHovered(
      rect !== null && bounds !== undefined
        ? { target, top: rect.top - bounds.top }
        : null
    );
  }

  return (
    <div
      ref={container}
      className={cn("relative", className)}
      onMouseMove={trackHoveredBlock}
      onMouseLeave={() => {
        if (!menuOpen) setHovered(null);
      }}
    >
      {/* The left inset is the handle's margin: the text starts where the
          gutter ends, so a handle never overlaps a word. */}
      <div className="pl-12">
        <EditorContent editor={editor} />
        <ClickToAppend editor={editor} editable={editable} />
      </div>

      {editor !== null && hovered !== null && editable && (
        <BlockGutter
          editor={editor}
          target={hovered.target}
          top={hovered.top}
          onOpenChange={setMenuOpen}
          onDone={() => setHovered(null)}
        />
      )}
    </div>
  );
}

/**
 * The empty space under the last block.
 *
 * Without it, clicking below a short document does nothing, and a block dragged
 * past the end has nowhere to land — both of which read as the editor ending
 * where the text does rather than where the page does.
 */
function ClickToAppend({
  editor,
  editable,
}: {
  editor: Editor | null;
  editable: boolean;
}) {
  if (editor === null || !editable) return null;
  return (
    <div
      aria-hidden
      className="h-24 cursor-text"
      onClick={() => editor.chain().focus("end").run()}
      onDragOver={(event) => {
        if (isDraggingBlock(editor.view)) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        dropBlockAtEnd(editor.view);
      }}
    />
  );
}
