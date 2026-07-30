/** Prototype inbox — items in the list pane, thread messages in the detail pane. */

export type InboxFilter = "all" | "unread" | "mentions"

export interface MockThreadMessage {
  id: string
  author: string
  time: string
  managed?: string
  body: ReadonlyArray<string>
}

export interface MockInboxItem {
  id: string
  author: string
  reason: string
  channel: string
  time: string
  preview: string
  unread: boolean
  mention: boolean
  thread: ReadonlyArray<MockThreadMessage>
}

export const INBOX_ITEMS: ReadonlyArray<MockInboxItem> = [
  {
    id: "i1",
    author: "Reviewer",
    reason: "Mentioned in",
    channel: "atlas-dev",
    time: "5:29 PM",
    preview:
      "Short version: the queue drain is safe to run twice, so the retry path does not need a lock.",
    unread: true,
    mention: true,
    thread: [
      {
        id: "m1",
        author: "Nadia",
        time: "Today at 3:42 PM",
        body: [
          "Reviewer, is the queue drain idempotent? I want to run it again after the backfill.",
        ],
      },
      {
        id: "m2",
        author: "Reviewer",
        time: "Today at 3:44 PM",
        managed: "managed by you",
        body: [
          "Short version: the queue drain is safe to run twice, so the retry path does not need a lock.",
          "Each batch is keyed by checkpoint id and the writer skips ids it has already committed. A second run over the same window is a no-op rather than a duplicate write.",
          "The one place I would be careful is the compaction step — it reads the checkpoint table without a transaction, so running it while the drain is live can shorten a window. Sequence them and you are fine.",
        ],
      },
      {
        id: "m3",
        author: "Nadia",
        time: "Today at 4:09 PM",
        body: ["Good enough for me. I will queue the backfill for tonight."],
      },
    ],
  },
  {
    id: "i2",
    author: "Ines",
    reason: "Thread in",
    channel: "onboarding-design",
    time: "2:37 PM",
    preview:
      "Dropped three options for the empty state — option 2 is my pick, but the copy needs a second pass.",
    unread: true,
    mention: false,
    thread: [
      {
        id: "m4",
        author: "Ines",
        time: "Today at 2:37 PM",
        body: [
          "Dropped three options for the empty state — option 2 is my pick, but the copy needs a second pass.",
          "The illustration is placeholder. If we keep the two-line layout I would rather cut the subtitle than shrink it.",
        ],
      },
      {
        id: "m5",
        author: "Sam",
        time: "Today at 2:51 PM",
        body: ["Agreed on 2. I will take the copy tomorrow morning."],
      },
    ],
  },
  {
    id: "i3",
    author: "Build",
    reason: "Thread in",
    channel: "pricing-launch",
    time: "11:04 AM",
    preview: "v2.14.0 is on staging. Smoke suite green, 4 minutes 12 seconds.",
    unread: true,
    mention: false,
    thread: [
      {
        id: "m6",
        author: "Build",
        time: "Today at 11:04 AM",
        managed: "managed by you",
        body: [
          "v2.14.0 is on staging. Smoke suite green, 4 minutes 12 seconds.",
          "Two flaky specs retried once and passed: the upload timeout and the websocket reconnect.",
        ],
      },
    ],
  },
  {
    id: "i4",
    author: "Theo",
    reason: "Mentioned in",
    channel: "atlas-incidents",
    time: "Yesterday",
    preview:
      "Root cause was the retry storm from the batch job — capping concurrency at 8 held it.",
    unread: true,
    mention: true,
    thread: [
      {
        id: "m7",
        author: "Theo",
        time: "Yesterday at 8:03 AM",
        body: [
          "Root cause was the retry storm from the batch job — capping concurrency at 8 held it.",
          "Ingest latency was over threshold for six minutes and resolved on its own once the queue drained.",
        ],
      },
    ],
  },
  {
    id: "i5",
    author: "Scribe",
    reason: "Thread in",
    channel: "atlas-migration",
    time: "Jul 28",
    preview: "Release notes for v2.13 are drafted and waiting on a read.",
    unread: false,
    mention: false,
    thread: [
      {
        id: "m8",
        author: "Scribe",
        time: "Jul 28 at 6:12 PM",
        managed: "managed by you",
        body: [
          "Release notes for v2.13 are drafted and waiting on a read.",
          "I left the migration note out because it only affects self-hosted installs — say the word and I will add it back.",
        ],
      },
    ],
  },
]

export const UNREAD_COUNT = INBOX_ITEMS.filter((i) => i.unread).length
