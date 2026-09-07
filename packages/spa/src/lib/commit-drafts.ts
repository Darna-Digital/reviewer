/**
 * The commit message being written, per project. A message drafted in the
 * background lands in a composer the user may well not be looking at — they
 * asked for it and moved on — so it is kept where leaving the commit view, or
 * the app, doesn't throw it away. Cleared when the commit is made.
 */
import { makeDraftStore } from "@/lib/drafts";

const { useDraft } = makeDraftStore("reviewer-commit-drafts");

export const useCommitMessage = (project: string) => useDraft(project);
