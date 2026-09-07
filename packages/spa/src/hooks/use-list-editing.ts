/**
 * List editing wired to a textarea: the newline key continues the list the
 * caret sits in, Tab re-nests it, and each edit renumbers the block around it
 * (see `lib/list-editing` for the text work itself).
 *
 * Which Enter reaches here is the composer's own business — in a session prompt
 * Enter sends and ⇧Enter opens a line, in a comment Enter opens a line and
 * ⌘Enter files it — so a caller hands the key over only once its own shortcuts
 * have had it, and reads the return to know whether it was spent. Keys that are
 * not a list edit come back false with nothing prevented, leaving Tab to move
 * focus and Enter to insert a plain newline.
 */
import { useLayoutEffect, useRef } from "react";
import {
  changedRange,
  continueList,
  shiftListIndent,
  type ComposerSelection,
} from "@/lib/list-editing";

/**
 * Keep the caret visible after an edit the browser did not scroll for. Lines
 * below the caret are measured off the line box; on the last line the exact
 * scroll height is used instead, so soft-wrapped text still lands right.
 */
function scrollCaretIntoView(textarea: HTMLTextAreaElement) {
  if (!textarea.value.slice(textarea.selectionEnd).includes("\n")) {
    textarea.scrollTop = textarea.scrollHeight;
    return;
  }
  const styles = getComputedStyle(textarea);
  const lineHeight =
    parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.5;
  const lines = textarea.value.slice(0, textarea.selectionEnd).split("\n");
  const caretBottom = parseFloat(styles.paddingTop) + lines.length * lineHeight;
  const overflow = caretBottom - (textarea.scrollTop + textarea.clientHeight);
  if (overflow > 0) textarea.scrollTop += overflow;
}

export function useListEditing({
  textareaRef,
  text,
  setText,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  text: string;
  setText: (next: string) => void;
}): (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean {
  // The caller owns the text, so an edit that has to go back through `setText`
  // can only put the caret where it left it once React has painted the rewrite.
  const pendingSelection = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const selection = pendingSelection.current;
    if (textarea === null || selection === null) return;
    pendingSelection.current = null;
    textarea.setSelectionRange(selection[0], selection[1]);
    scrollCaretIntoView(textarea);
  }, [text, textareaRef]);

  const apply = (edit: ComposerSelection | null): boolean => {
    if (edit === null) return false;
    const textarea = textareaRef.current;
    if (textarea !== null) {
      // Rewriting only the span that actually changed, through the browser's own
      // text insertion, keeps ⌘Z undoing the list edit rather than the whole
      // draft. The fallback below is for anywhere `execCommand` refuses.
      const [start, end, replacement] = changedRange(text, edit.text);
      textarea.setSelectionRange(start, end);
      if (document.execCommand("insertText", false, replacement)) {
        textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        scrollCaretIntoView(textarea);
        return true;
      }
    }
    pendingSelection.current = [edit.selectionStart, edit.selectionEnd];
    setText(edit.text);
    return true;
  };

  return (event) => {
    const selection = {
      text,
      selectionStart: event.currentTarget.selectionStart,
      selectionEnd: event.currentTarget.selectionEnd,
    };
    const edit =
      event.key === "Enter"
        ? continueList(selection)
        : event.key === "Tab"
          ? shiftListIndent(selection, event.shiftKey ? -1 : 1)
          : null;
    if (!apply(edit)) return false;
    event.preventDefault();
    return true;
  };
}
