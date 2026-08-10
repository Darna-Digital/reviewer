/**
 * Prototype inbox — what the workspace is waiting on you for.
 *
 * Every item is a person doing something to a task: assigning it, commenting on
 * it, naming you in a comment, moving it. The task and the thread underneath it
 * are the real ones from `collaboration.mock`, so an item is a pointer rather
 * than a second copy — reading the inbox and opening the task show the same
 * conversation.
 */
import {
  findTask,
  type MockActivity,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";

export type InboxFilter = "all" | "unread" | "mentions";

/** What the person did. The list reads as "{who} {reason} {task}". */
export type InboxReason = "assigned" | "mentioned" | "commented" | "moved";

export const REASON_LABEL: Record<InboxReason, string> = {
  assigned: "Assigned you",
  mentioned: "Mentioned you on",
  commented: "Commented on",
  moved: "Moved",
};

export interface MockInboxItem {
  id: string;
  /** The teammate who did it — an inbox item is always somebody's doing. */
  author: string;
  reason: InboxReason;
  /** The task it happened on, by id in `collaboration.mock`. */
  taskId: string;
  time: string;
  preview: string;
  unread: boolean;
  mention: boolean;
}

export const INBOX_ITEMS: ReadonlyArray<MockInboxItem> = [
  {
    id: "i1",
    author: "Nadia Alvi",
    reason: "assigned",
    taskId: "atlas-2",
    time: "2:14 PM",
    preview:
      "Handing this to you — the dry run is clean, so it is the second pass and the sign-off left.",
    unread: true,
    mention: false,
  },
  {
    id: "i2",
    author: "Ines Faber",
    reason: "mentioned",
    taskId: "onboarding-1",
    time: "11:40 AM",
    preview:
      "Does the second screen still need the workspace name, or can we infer it from the invite?",
    unread: true,
    mention: true,
  },
  {
    id: "i3",
    author: "Theo Brandt",
    reason: "commented",
    taskId: "atlas-1",
    time: "9:05 AM",
    preview:
      "Shadow run took 40 minutes for a full pass. Safe to repeat, so I am moving it to review.",
    unread: true,
    mention: false,
  },
  {
    id: "i4",
    author: "Sam Okoro",
    reason: "commented",
    taskId: "mobile-1",
    time: "Yesterday",
    preview:
      "Conflict rule is written but untested against a cold start mid-sync.",
    unread: true,
    mention: false,
  },
  {
    id: "i5",
    author: "Nadia Alvi",
    reason: "moved",
    taskId: "pricing-1",
    time: "Jul 28",
    preview: "Moved from Todo to In Progress.",
    unread: false,
    mention: false,
  },
];

export const UNREAD_COUNT = INBOX_ITEMS.filter((i) => i.unread).length;

export const inboxTask = (item: MockInboxItem): MockTask | undefined =>
  findTask(item.taskId);

/** The task's own comments — the thread an item drops you into. */
export const inboxComments = (
  item: MockInboxItem
): ReadonlyArray<MockActivity> =>
  findTask(item.taskId)?.activity.filter((entry) => entry.kind === "comment") ??
  [];
