/**
 * Prototype data for the collaboration mode — no API behind it yet.
 *
 * Projects own the tree: every task and every channel carries the project it
 * belongs to, so the sidebar can nest them and the panes can look either way
 * (project → its work, task/channel → its project) from the same arrays.
 */

export type CollaborationView =
  | "project"
  | "channel"
  | "task"
  | "agents"
  | "members"

export type TaskStatus = "todo" | "doing" | "review" | "done"

export const UNASSIGNED = "Unassigned"

export interface MockSubtask {
  id: string
  title: string
  done: boolean
}

export interface MockTask {
  id: string
  projectId: string
  title: string
  status: TaskStatus
  assignee: string
  due: string
  note: string
  subtasks: ReadonlyArray<MockSubtask>
}

export interface MockChannel {
  id: string
  name: string
  topic: string
  unread: number
  projectId?: string
}

export interface MockProject {
  id: string
  name: string
  color: string
  summary: string
  lead: string
  target: string
}

export interface MockMessage {
  id: string
  author: string
  time: string
  day: string
  body: string
}

export interface MockPerson {
  id: string
  name: string
  detail: string
  online: boolean
}

export interface MockWorkspace {
  id: string
  name: string
  detail: string
  color: string
}

export const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  "doing",
  "review",
  "todo",
  "done",
]

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
}

export const WORKSPACES: ReadonlyArray<MockWorkspace> = [
  {
    id: "darna",
    name: "Darna Digital HQ",
    detail: "12 members, 4 agents",
    color: "#7C8CF8",
  },
  {
    id: "hans",
    name: "Hans Natur",
    detail: "5 members, 1 agent",
    color: "#5BC0A8",
  },
  { id: "personal", name: "Personal", detail: "Just you", color: "#E2707F" },
]

export const PROJECTS: ReadonlyArray<MockProject> = [
  {
    id: "atlas",
    name: "Atlas rewrite",
    color: "#7C8CF8",
    summary: "Move the ingest pipeline off the legacy worker.",
    lead: "Theo Brandt",
    target: "Aug 14",
  },
  {
    id: "pricing",
    name: "Pricing page",
    color: "#F2A65A",
    summary: "New tiers, an annual toggle, and a comparison table.",
    lead: "Nadia Alvi",
    target: "Aug 4",
  },
  {
    id: "onboarding",
    name: "Onboarding v2",
    color: "#5BC0A8",
    summary: "Cut the first-run flow from nine steps to four.",
    lead: "Ines Faber",
    target: "Sep 1",
  },
  {
    id: "mobile",
    name: "Mobile shell",
    color: "#E2707F",
    summary: "A native wrapper with offline drafts.",
    lead: "Sam Okoro",
    target: "Oct 9",
  },
]

export const CHANNELS: ReadonlyArray<MockChannel> = [
  {
    id: "general",
    name: "general",
    topic: "Anything and everything",
    unread: 0,
  },
  {
    id: "releases",
    name: "releases",
    topic: "Ship notes and rollbacks",
    unread: 3,
  },
  {
    id: "incidents",
    name: "incidents",
    topic: "Pager traffic lands here",
    unread: 12,
  },
  {
    id: "atlas-dev",
    name: "atlas-dev",
    topic: "Pipeline work in the open",
    unread: 2,
    projectId: "atlas",
  },
  {
    id: "atlas-migration",
    name: "atlas-migration",
    topic: "Cutover planning and dry runs",
    unread: 0,
    projectId: "atlas",
  },
  {
    id: "pricing-copy",
    name: "pricing-copy",
    topic: "Wording for the new tiers",
    unread: 1,
    projectId: "pricing",
  },
  {
    id: "onboarding-design",
    name: "onboarding-design",
    topic: "Crits, mocks, and motion",
    unread: 0,
    projectId: "onboarding",
  },
  {
    id: "mobile-beta",
    name: "mobile-beta",
    topic: "Field reports from the TestFlight build",
    unread: 4,
    projectId: "mobile",
  },
]

export const TASKS: ReadonlyArray<MockTask> = [
  {
    id: "atlas-1",
    projectId: "atlas",
    title: "Drain the legacy queue",
    status: "doing",
    assignee: "Theo Brandt",
    due: "Aug 1",
    note: "Idempotent per checkpoint id, so a second pass over the same window is a no-op.",
    subtasks: [
      { id: "atlas-1-a", title: "Batch by checkpoint id", done: true },
      { id: "atlas-1-b", title: "Skip already-committed ids", done: true },
      { id: "atlas-1-c", title: "Sequence after compaction", done: false },
    ],
  },
  {
    id: "atlas-2",
    projectId: "atlas",
    title: "Backfill checkpoints",
    status: "review",
    assignee: "Nadia Alvi",
    due: "Aug 5",
    note: "Runs tonight once the drain lands. Needs a dry run against last week's window first.",
    subtasks: [
      { id: "atlas-2-a", title: "Dry run on staging", done: true },
      { id: "atlas-2-b", title: "Schedule the real run", done: false },
    ],
  },
  {
    id: "atlas-3",
    projectId: "atlas",
    title: "Delete the old worker",
    status: "todo",
    assignee: UNASSIGNED,
    due: "Aug 14",
    note: "Blocked until the backfill has been green for a week.",
    subtasks: [],
  },
  {
    id: "atlas-4",
    projectId: "atlas",
    title: "Cap retry concurrency at 8",
    status: "done",
    assignee: "Theo Brandt",
    due: "Jul 28",
    note: "Held the retry storm that took ingest latency over threshold on the 27th.",
    subtasks: [{ id: "atlas-4-a", title: "Add the semaphore", done: true }],
  },
  {
    id: "pricing-1",
    projectId: "pricing",
    title: "Comparison table copy",
    status: "doing",
    assignee: "Nadia Alvi",
    due: "Aug 1",
    note: "Six rows, no marketing adjectives. Sam has the plan names.",
    subtasks: [
      { id: "pricing-1-a", title: "Draft the rows", done: true },
      { id: "pricing-1-b", title: "Second pass on tier names", done: false },
    ],
  },
  {
    id: "pricing-2",
    projectId: "pricing",
    title: "Annual toggle",
    status: "done",
    assignee: "Ines Faber",
    due: "Jul 24",
    note: "Ships with the discount badge on the annual side.",
    subtasks: [],
  },
  {
    id: "pricing-3",
    projectId: "pricing",
    title: "Currency switch for the EU",
    status: "todo",
    assignee: "Sam Okoro",
    due: "Aug 4",
    note: "Euro only for now. VAT copy is legal's call.",
    subtasks: [],
  },
  {
    id: "onboarding-1",
    projectId: "onboarding",
    title: "Collapse steps 3 to 6",
    status: "doing",
    assignee: "Ines Faber",
    due: "Aug 8",
    note: "One screen with progressive disclosure instead of four sequential ones.",
    subtasks: [
      { id: "onboarding-1-a", title: "Merge the workspace steps", done: true },
      { id: "onboarding-1-b", title: "Move invites to the end", done: false },
    ],
  },
  {
    id: "onboarding-2",
    projectId: "onboarding",
    title: "Skip-for-now path",
    status: "review",
    assignee: "Theo Brandt",
    due: "Aug 11",
    note: "Anyone who skips lands on an empty state that can finish setup later.",
    subtasks: [],
  },
  {
    id: "onboarding-3",
    projectId: "onboarding",
    title: "Rewrite the empty states",
    status: "todo",
    assignee: "Sam Okoro",
    due: "Sep 1",
    note: "Three options are up for review in the design channel.",
    subtasks: [],
  },
  {
    id: "mobile-1",
    projectId: "mobile",
    title: "Offline draft store",
    status: "doing",
    assignee: "Sam Okoro",
    due: "Aug 20",
    note: "Drafts survive a cold start and sync on the next foreground.",
    subtasks: [
      { id: "mobile-1-a", title: "Local queue", done: true },
      { id: "mobile-1-b", title: "Conflict resolution", done: false },
    ],
  },
  {
    id: "mobile-2",
    projectId: "mobile",
    title: "Push notification permissions",
    status: "todo",
    assignee: UNASSIGNED,
    due: "Oct 9",
    note: "Ask on first mention, never at launch.",
    subtasks: [],
  },
]

export const MESSAGES: Record<string, ReadonlyArray<MockMessage>> = {
  general: [
    {
      id: "general-1",
      author: "Nadia Alvi",
      time: "9:12 AM",
      day: "Today",
      body: "Standup moved to 10:30 for the rest of the week.",
    },
    {
      id: "general-2",
      author: "Theo Brandt",
      time: "9:20 AM",
      day: "Today",
      body: "Works for me. I will post notes in the thread after.",
    },
    {
      id: "general-3",
      author: "Reviewer",
      time: "9:41 AM",
      day: "Today",
      body: "Two of yesterday's pull requests still need a second pass.",
    },
  ],
  releases: [
    {
      id: "releases-1",
      author: "Build",
      time: "6:04 PM",
      day: "Yesterday",
      body: "v2.13.4 is out. No rollbacks queued.",
    },
    {
      id: "releases-2",
      author: "Build",
      time: "7:02 AM",
      day: "Today",
      body: "v2.14.0 is on staging. Smoke suite green in 4m12s.",
    },
    {
      id: "releases-3",
      author: "Nadia Alvi",
      time: "8:15 AM",
      day: "Today",
      body: "Holding the production push until the pricing copy lands.",
    },
  ],
  incidents: [
    {
      id: "incidents-1",
      author: "Pager",
      time: "2:44 AM",
      day: "Today",
      body: "Ingest latency over threshold for 6 minutes. Auto-resolved.",
    },
    {
      id: "incidents-2",
      author: "Theo Brandt",
      time: "8:03 AM",
      day: "Today",
      body: "Root cause was the retry storm from the batch job. Capping concurrency at 8 held it.",
    },
  ],
  "atlas-dev": [
    {
      id: "atlas-dev-1",
      author: "Theo Brandt",
      time: "4:31 PM",
      day: "Yesterday",
      body: "Drain is running against the shadow queue. 40 minutes for a full pass.",
    },
    {
      id: "atlas-dev-2",
      author: "Reviewer",
      time: "9:02 AM",
      day: "Today",
      body: "The writer skips committed checkpoint ids, so a repeat run is safe.",
    },
    {
      id: "atlas-dev-3",
      author: "Nadia Alvi",
      time: "9:48 AM",
      day: "Today",
      body: "Then I will queue the backfill for tonight.",
    },
  ],
  "atlas-migration": [
    {
      id: "atlas-migration-1",
      author: "Nadia Alvi",
      time: "11:15 AM",
      day: "Monday",
      body: "Cutover window is Thursday 22:00 to 02:00. Two dry runs before then.",
    },
  ],
  "pricing-copy": [
    {
      id: "pricing-copy-1",
      author: "Sam Okoro",
      time: "1:22 PM",
      day: "Today",
      body: "Plan names are locked: Starter, Team, Scale.",
    },
    {
      id: "pricing-copy-2",
      author: "Nadia Alvi",
      time: "1:40 PM",
      day: "Today",
      body: "Then the comparison rows can go in as they are. I will drop the adjectives.",
    },
  ],
  "onboarding-design": [
    {
      id: "onboarding-design-1",
      author: "Ines Faber",
      time: "2:37 PM",
      day: "Yesterday",
      body: "Three options for the empty state are up. Option 2 is my pick, the copy needs a pass.",
    },
    {
      id: "onboarding-design-2",
      author: "Sam Okoro",
      time: "2:51 PM",
      day: "Yesterday",
      body: "Agreed on 2. I will take the copy tomorrow morning.",
    },
  ],
  "mobile-beta": [
    {
      id: "mobile-beta-1",
      author: "Sam Okoro",
      time: "10:05 AM",
      day: "Today",
      body: "Build 41 is on TestFlight. Drafts now survive a cold start.",
    },
    {
      id: "mobile-beta-2",
      author: "Ines Faber",
      time: "10:31 AM",
      day: "Today",
      body: "Two taps to reach the composer from a cold launch. Feels right.",
    },
  ],
}

export const AGENTS: ReadonlyArray<MockPerson> = [
  {
    id: "reviewer",
    name: "Reviewer",
    detail: "Watches open pull requests",
    online: true,
  },
  {
    id: "build",
    name: "Build",
    detail: "Runs CI and posts results",
    online: true,
  },
  {
    id: "scribe",
    name: "Scribe",
    detail: "Writes release notes",
    online: false,
  },
]

export const MEMBERS: ReadonlyArray<MockPerson> = [
  { id: "nadia", name: "Nadia Alvi", detail: "Engineering lead", online: true },
  { id: "theo", name: "Theo Brandt", detail: "Backend", online: true },
  { id: "ines", name: "Ines Faber", detail: "Design", online: false },
  { id: "sam", name: "Sam Okoro", detail: "Product", online: false },
]

/** What an unqualified `/modes/collaboration` shows — the lead project. */
export const DEFAULT_VIEW: CollaborationView = "project"
export const DEFAULT_ID = PROJECTS[0]?.id ?? ""

export const TEAM_CHANNELS = CHANNELS.filter((c) => c.projectId === undefined)

export const projectChannels = (projectId: string) =>
  CHANNELS.filter((c) => c.projectId === projectId)

export const projectTasks = (projectId: string) =>
  TASKS.filter((t) => t.projectId === projectId)

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id)

export const findChannel = (id: string) => CHANNELS.find((c) => c.id === id)

export const findTask = (id: string) => TASKS.find((t) => t.id === id)

export const openTaskCount = (projectId: string) =>
  projectTasks(projectId).filter((t) => t.status !== "done").length
