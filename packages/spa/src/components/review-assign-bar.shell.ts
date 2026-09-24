/**
 * The assign bar, handed to the native shell.
 *
 * In the macOS window the bar is the window's own: the shell floats it over
 * the page island natively — the same count, target picker, model chip and
 * Assign the web `ReviewAssignBar` wears — from a picture of what the bar
 * would be given, and sends back what was done to it. The comments, the
 * hand-off and the jump to a comment's line stay this page's: the chat is
 * made, the prompt built and the comments resolved here, the way they are for
 * the web bar; the shell only ever asks. The sessions and the model catalog
 * the picker lists are not in the picture — the shell reads both from the
 * server itself, as it does for its own composer.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AssignBarComment, AssignTarget } from "./review-assign-bar";
import {
  island,
  shell,
  type ShellReview,
  type ShellReviewAction,
} from "@/lib/shell";

/** Whether the bar is the shell's to draw rather than this document's. */
export const shellDrawsAssignBar = island === "code";

/** What the shell's bar is drawn from — the web bar's props, minus the DOM. */
export interface ShellReviewSource {
  readonly comments: ReadonlyArray<AssignBarComment>;
  readonly branch: string;
  readonly onAssign: (target: AssignTarget) => Promise<void> | void;
  readonly onOpenComment: (id: string) => void;
  readonly onDeleteComment: (id: string) => Promise<void> | void;
}

/**
 * Keep the shell's bar in step with `source`, and its actions flowing back
 * into it; no comments, or null, takes the bar down.
 */
export function useShellReview(source: ShellReviewSource | null): void {
  const latest = useRef(source);
  latest.current = source;
  const [assigning, setAssigning] = useState(false);

  const comments = source?.comments ?? null;
  const branch = source?.branch ?? "";
  const review = useMemo<ShellReview | null>(
    () =>
      shellDrawsAssignBar && comments !== null && comments.length > 0
        ? { comments, branch, assigning }
        : null,
    [comments, branch, assigning]
  );
  useEffect(() => {
    if (!shellDrawsAssignBar) return;
    void shell.post({ type: "review", review });
  }, [review]);
  useEffect(() => {
    if (!shellDrawsAssignBar) return;
    return () => void shell.post({ type: "review", review: null });
  }, []);

  useEffect(() => {
    if (!shellDrawsAssignBar) return;
    const act = async (action: ShellReviewAction) => {
      const current = latest.current;
      if (current === null) return;
      switch (action.kind) {
        case "assign":
          setAssigning(true);
          try {
            await current.onAssign(action.target);
          } finally {
            setAssigning(false);
          }
          return;
        case "open":
          return current.onOpenComment(action.id);
        case "delete":
          return void current.onDeleteComment(action.id);
      }
    };
    return shell.subscribe((event) => {
      if (event.type === "review") void act(event.action);
    });
  }, []);
}
