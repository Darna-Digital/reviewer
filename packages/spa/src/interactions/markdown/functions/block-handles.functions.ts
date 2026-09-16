/**
 * Finding and moving the block under the pointer.
 *
 * This is the machinery behind the handle that appears in the left margin as
 * you hover a block — the drag grip, the plus, and the menu that moves,
 * duplicates or deletes. ProseMirror has no notion of "the block you are
 * pointing at", so each of those is a small piece of position arithmetic over
 * the document, kept here rather than in the component that draws the handle.
 *
 * Adapted from the block editor in byconvo, which is where this interaction was
 * worked out.
 */
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export interface BlockTarget {
  readonly pos: number;
  readonly node: ProseMirrorNode;
}

const LIST_TYPES = ["bulletList", "orderedList", "taskList"];
const ITEM_TYPES = ["listItem", "taskItem"];

/**
 * The block on the line the pointer is on.
 *
 * Probed from the horizontal centre of the editor rather than the pointer's own
 * x, so the handle still finds the block while the pointer is out in the margin
 * hovering the handle itself.
 *
 * Inside a list the item is the block, not the list: moving or deleting "this
 * bullet" is what the handle beside a bullet has to mean.
 */
export function blockAt(view: EditorView, clientY: number): BlockTarget | null {
  const bounds = view.dom.getBoundingClientRect();
  const found = view.posAtCoords({
    left: bounds.left + bounds.width / 2,
    top: clientY,
  });
  if (found === null) return null;

  const $pos = view.state.doc.resolve(
    found.inside >= 0 ? found.inside : found.pos
  );
  if ($pos.depth === 0) {
    const node = $pos.nodeAfter;
    return node?.isBlock === true ? { pos: $pos.pos, node } : null;
  }

  const depth =
    $pos.depth > 1 && LIST_TYPES.includes($pos.node(1).type.name) ? 2 : 1;
  return { pos: $pos.before(depth), node: $pos.node(depth) };
}

export function blockRect(
  view: EditorView,
  target: BlockTarget
): DOMRect | null {
  const dom = view.nodeDOM(target.pos);
  return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
}

export function canMoveBlock(
  editor: Editor,
  target: BlockTarget,
  offset: number
): boolean {
  const $pos = editor.state.doc.resolve(target.pos);
  const destination = $pos.index() + offset;
  return destination >= 0 && destination < $pos.parent.childCount;
}

/**
 * Swap a block past its neighbour.
 *
 * Delete then insert, with the insertion point mapped through the deletion:
 * computing both positions up front and applying them in sequence would place
 * the second against a document that no longer exists.
 */
export function moveBlock(
  editor: Editor,
  target: BlockTarget,
  offset: number
): void {
  const { state, view } = editor;
  const $pos = state.doc.resolve(target.pos);
  const index = $pos.index();
  const destination = index + offset;
  if (destination < 0 || destination >= $pos.parent.childCount) return;

  const node = $pos.parent.child(index);
  const to = target.pos + node.nodeSize;
  const anchor =
    offset > 0
      ? to + $pos.parent.child(index + 1).nodeSize
      : target.pos - $pos.parent.child(index - 1).nodeSize;

  const transaction = state.tr.delete(target.pos, to);
  view.dispatch(
    transaction.insert(transaction.mapping.map(anchor), node).scrollIntoView()
  );
}

export function duplicateBlock(editor: Editor, target: BlockTarget): void {
  const node = editor.state.doc.nodeAt(target.pos);
  if (node === null) return;
  editor.view.dispatch(
    editor.state.tr.insert(target.pos + node.nodeSize, node)
  );
}

/**
 * Delete a block, and the list around it when it was the last item — an empty
 * list left behind is a bullet with nothing after it, which nobody asked for.
 * Deleting the only block in the document clears it instead, since the schema
 * will not allow an empty one.
 */
export function removeBlock(editor: Editor, target: BlockTarget): void {
  const { state, view } = editor;
  const node = state.doc.nodeAt(target.pos);
  if (node === null) return;

  const $pos = state.doc.resolve(target.pos);
  if (state.doc.childCount === 1 && $pos.depth === 0) {
    editor.chain().focus().clearContent(true).run();
    return;
  }

  const emptiesParent = $pos.depth > 0 && $pos.parent.childCount === 1;
  const from = emptiesParent ? $pos.before($pos.depth) : target.pos;
  const to = emptiesParent
    ? $pos.after($pos.depth)
    : target.pos + node.nodeSize;
  view.dispatch(state.tr.delete(from, to));
}

/** The plus beside a block: a sibling of the same kind, with the caret in it. */
export function insertBlockAfter(editor: Editor, target: BlockTarget): void {
  const { state, view } = editor;
  const node = state.doc.nodeAt(target.pos);
  if (node === null) return;

  const inserted = ITEM_TYPES.includes(node.type.name)
    ? node.type.createAndFill()
    : state.schema.nodes.paragraph?.create();
  if (inserted === null || inserted === undefined) return;

  const at = target.pos + node.nodeSize;
  const transaction = state.tr.insert(at, inserted);
  view.dispatch(
    transaction
      .setSelection(TextSelection.near(transaction.doc.resolve(at + 1)))
      .scrollIntoView()
  );
  view.focus();
}

/** A command chain aimed at a block the caret is not currently in. */
export function chainInsideBlock(editor: Editor, target: BlockTarget) {
  const selection = TextSelection.near(
    editor.state.doc.resolve(target.pos + 1)
  );
  return editor.chain().focus().setTextSelection(selection.from);
}

/**
 * Hand the drag to ProseMirror.
 *
 * Its own drop handling already knows where a block may legally land and draws
 * the cursor for it, so the grip only has to say what is being dragged and let
 * the view take over.
 */
export function startBlockDrag(
  view: EditorView,
  target: BlockTarget,
  event: DragEvent
): void {
  const { dataTransfer } = event;
  if (dataTransfer === null) return;

  const selection = NodeSelection.create(view.state.doc, target.pos);
  const slice = selection.content();
  const serialized = view.serializeForClipboard(slice);
  const dom = view.nodeDOM(target.pos);

  view.dispatch(view.state.tr.setSelection(selection));
  view.dragging = { slice, move: true };

  dataTransfer.effectAllowed = "move";
  dataTransfer.setData("text/html", serialized.dom.innerHTML);
  dataTransfer.setData("text/plain", serialized.text);
  if (dom instanceof HTMLElement) dataTransfer.setDragImage(dom, 0, 0);
}

export function endBlockDrag(view: EditorView): void {
  view.dragging = null;
}

export const isDraggingBlock = (view: EditorView): boolean =>
  view.dragging !== null;

/** Dropping into the empty space under the last block appends to the document. */
export function dropBlockAtEnd(view: EditorView): void {
  const dragged = view.dragging;
  if (dragged === null) return;
  view.dragging = null;

  const transaction = view.state.tr.deleteSelection();
  const end = transaction.doc.content.size;
  view.dispatch(
    transaction.replaceRange(end, end, dragged.slice).scrollIntoView()
  );
}
