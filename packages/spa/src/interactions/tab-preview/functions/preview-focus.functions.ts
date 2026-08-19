/**
 * Who the keyboard belongs to while the mill is working.
 *
 * A page coming up in the frame focuses something on its way — a composer, a
 * search field — and the caret leaves the window someone is typing in for a
 * frame parked off the side of it. The preview refuses focus from the inside
 * (see `preview-window`), but a refusal only puts the caret down: the element
 * that had it is in this document, and only this document can hand it back.
 *
 * So the window remembers who was typing, and gives the keyboard back the
 * moment the frame takes it.
 */

export interface KeyboardGuard {
  /** Hand the keyboard back, if the frame is the one holding it. */
  readonly restore: () => void;
  readonly stop: () => void;
}

export function guardKeyboard(frame: HTMLIFrameElement): KeyboardGuard {
  const doc = frame.ownerDocument;
  let owner: HTMLElement | null = null;

  const remember = (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && target !== frame) owner = target;
  };

  const restore = () => {
    if (doc.activeElement !== frame) return;
    if (owner === null || !owner.isConnected) {
      frame.blur();
      return;
    }
    owner.focus({ preventScroll: true });
  };

  doc.addEventListener("focusin", remember, true);
  frame.addEventListener("focus", restore);

  return {
    restore,
    stop: () => {
      doc.removeEventListener("focusin", remember, true);
      frame.removeEventListener("focus", restore);
    },
  };
}
