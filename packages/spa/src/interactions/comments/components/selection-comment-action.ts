/**
 * The "Comment" popover that appears over a selection.
 *
 * This is how a comment is started now that the file is always editable: there
 * is no read-only mode left for the gutter's `+` to live in, because an
 * editable view takes the caret on every click. Highlighting the passage you
 * mean and being offered a comment on it is the gesture that replaces it — and
 * it says more than a line number did, since the selection is the subject.
 *
 * `@pierre/diffs` owns the hard half: it mounts this element only after a
 * *user-created*, non-collapsed selection, keeps it out of the way of the drag
 * that made it, repositions it as the view scrolls, and tears it down. All that
 * is left here is the button and what it means. It is built imperatively rather
 * than in React because the editor mounts it into its own shadow root, where
 * neither the app's stylesheet nor a React tree can reach — hence the CSS
 * travelling alongside it.
 */

/** Marks the element, so the styles below and nothing else apply to it. */
const ACTION = "data-comment-action";

export const SELECTION_COMMENT_CSS = `
[${ACTION}] {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid color-mix(in lab, var(--diffs-fg) 15%, transparent);
  border-radius: 6px;
  background-color: var(--diffs-bg);
  box-shadow: 0 2px 8px #0000001f, 0 6px 18px #00000014;
  color: var(--diffs-fg);
  font: 500 12px/1.4 var(--diffs-header-font-fallback, system-ui, sans-serif);
  cursor: pointer;
  white-space: nowrap;
}
[${ACTION}]:hover {
  background-color: color-mix(in lab, var(--diffs-fg) 6%, var(--diffs-bg));
}
[${ACTION}]:focus-visible {
  outline: 2px solid var(--diffs-modified-base);
  outline-offset: 1px;
}
[${ACTION}] svg { width: 13px; height: 13px; display: block; }

/* A composer is already open for this file: the offer has been taken up, and
   repeating it over the box the user is typing in is just in the way. The
   selection stays lit, so what the comment is about is still visible.

   The editor's own widget shell is what goes, not the button inside it — the
   shell carries a border, a background and a 9px radius of its own, so hiding
   only its contents leaves a small empty circle floating over the composer.
   The override is forced because that shell is styled from the editor's own
   stylesheet, which outranks anything handed to it through unsafeCSS. */
:host([data-drafting]) [data-selection-action-popover] {
  display: none !important;
}
`;

/** The speech bubble, inline so it needs nothing from outside the shadow root. */
const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

export interface SelectionCommentAction {
  /** Called with the one-based line the comment should be filed against. */
  readonly onComment: () => void;
  /** Dismiss the popover — the editor's own teardown. */
  readonly close: () => void;
}

/**
 * Build the popover. Handed to the editor as `renderSelectionAction`; it takes
 * ownership of the element from here.
 */
export function selectionCommentAction({
  onComment,
  close,
}: SelectionCommentAction): HTMLElement {
  const button = document.createElement("button");
  button.setAttribute(ACTION, "");
  button.type = "button";
  button.innerHTML = `${ICON}<span>Comment</span>`;
  // The press must not travel on to the code underneath, which would collapse
  // the selection this is offering to comment on.
  button.addEventListener("pointerdown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onComment();
    close();
  });
  return button;
}
