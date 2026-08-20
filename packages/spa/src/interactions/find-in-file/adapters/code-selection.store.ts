/**
 * Who can say what is highlighted in the code right now.
 *
 * ⌘⇧F is a global gesture — it belongs to the search dialog, which is mounted
 * once for the whole shell and knows nothing about which file is open. The
 * selection it wants to search for is inside a code view's shadow root, and in
 * the editable view is not a DOM selection at all but the editor's own. So the
 * open view leaves a way to ask, for as long as it is open, and the gesture
 * asks. One view is open at a time, so one reader is all this holds.
 */

let read: (() => string) | null = null;

/** Offer this view's selection while it is mounted. */
export const registerCodeSelection = (reader: () => string): (() => void) => {
  read = reader;
  return () => {
    // A later view may already have taken over; only the current one clears.
    if (read === reader) read = null;
  };
};

/**
 * The phrase highlighted in the open file, or "" when nothing is. Falls back to
 * the page's own selection, so highlighting something in a list or a diff and
 * asking to search for it works too.
 */
export const selectedCodeText = (): string => {
  const inCode = read?.() ?? "";
  if (inCode !== "") return inCode;
  if (typeof document === "undefined") return "";
  return document.getSelection()?.toString() ?? "";
};

/** Test seam: forget the view that registered. */
export const resetCodeSelection = (): void => {
  read = null;
};
