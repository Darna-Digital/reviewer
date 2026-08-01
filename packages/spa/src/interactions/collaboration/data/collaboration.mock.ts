/**
 * Prototype data for the collaboration mode — no API behind it yet.
 *
 * Projects own the tree: every task and every channel carries the project it
 * belongs to, so the sidebar can nest them and the panes can look either way
 * (project → its work, task/channel → its project) from the same arrays.
 */

export type CollaborationView =
  | "project"
  | "tasks"
  | "task"
  | "docs"
  | "channel"
  | "agents"
  | "members"

export type TaskStatus = "todo" | "doing" | "review" | "done"

export const UNASSIGNED = "Unassigned"

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none"

export interface MockActivity {
  id: string
  kind: "created" | "priority" | "status" | "comment"
  author: string
  time: string
  /** What happened, for everything but a comment. */
  detail?: string
  /** The comment itself. */
  body?: string
}

export interface MockTask {
  id: string
  /** The short key the list and the header show, e.g. BYC-224. */
  key: string
  projectId: string
  /** Set on a sub-issue; the list nests it under its parent. */
  parentId?: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  labels: ReadonlyArray<string>
  updated: string
  description: ReadonlyArray<string>
  activity: ReadonlyArray<MockActivity>
}

export interface MockDoc {
  id: string
  projectId: string
  title: string
  summary: string
  author: string
  updated: string
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

export interface MockViewer {
  name: string
  email: string
}

export const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  "doing",
  "review",
  "todo",
  "done",
]

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "In Progress",
  review: "In Review",
  done: "Done",
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
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

/** Whoever is signed in — the account the workspace picker hangs off. */
export const VIEWER: MockViewer = {
  name: "Rūtenis Raila",
  email: "rutenis@darnadigital.com",
}

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
    id: "atlas-incidents",
    name: "atlas-incidents",
    topic: "Pager traffic from the pipeline",
    unread: 12,
    projectId: "atlas",
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
    id: "pricing-launch",
    name: "pricing-launch",
    topic: "Ship notes and rollbacks for the new tiers",
    unread: 3,
    projectId: "pricing",
  },
  {
    id: "pricing-copy",
    name: "pricing-copy",
    topic: "Wording for the new tiers",
    unread: 1,
    projectId: "pricing",
  },
  {
    id: "onboarding-research",
    name: "onboarding-research",
    topic: "Session notes from the first-run study",
    unread: 0,
    projectId: "onboarding",
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
    key: "BYC-224",
    projectId: "atlas",
    title: "Drain the legacy queue before the cutover",
    status: "review",
    priority: "urgent",
    assignee: "Theo Brandt",
    labels: ["pipeline", "cutover"],
    updated: "Jul 28",
    description: [
      "The drain is idempotent per checkpoint id, so a second pass over the same window is a no-op rather than a duplicate write.",
      "Compaction reads the checkpoint table without a transaction, so it has to be sequenced after the drain rather than run alongside it.",
      "Once this is green for a week the old worker can go.",
    ],
    activity: [
      {
        id: "atlas-1-a1",
        kind: "created",
        author: "Nadia Alvi",
        time: "2d ago",
        detail: "created the task",
      },
      {
        id: "atlas-1-a2",
        kind: "priority",
        author: "Nadia Alvi",
        time: "2d ago",
        detail: "set priority to Urgent",
      },
      {
        id: "atlas-1-a3",
        kind: "comment",
        author: "Theo Brandt",
        time: "2d ago",
        body: "Shadow run took 40 minutes for a full pass. Safe to repeat, so I am moving it to review.",
      },
      {
        id: "atlas-1-a4",
        kind: "status",
        author: "Theo Brandt",
        time: "2d ago",
        detail: "moved from In Progress to In Review",
      },
    ],
  },
  {
    id: "atlas-2",
    key: "BYC-218",
    projectId: "atlas",
    title: "Backfill checkpoints",
    status: "doing",
    priority: "high",
    assignee: "Nadia Alvi",
    labels: ["pipeline"],
    updated: "Jul 27",
    description: [
      "Runs tonight once the drain lands. A dry run against last week's window comes first.",
    ],
    activity: [
      {
        id: "atlas-2-a1",
        kind: "created",
        author: "Nadia Alvi",
        time: "5d ago",
        detail: "created the task",
      },
      {
        id: "atlas-2-a2",
        kind: "comment",
        author: "Reviewer",
        time: "1d ago",
        body: "Dry run is clean. Nothing in the diff beyond the expected checkpoint rows.",
      },
    ],
  },
  {
    id: "atlas-3",
    key: "BYC-193",
    projectId: "atlas",
    title: "Web infra",
    status: "todo",
    priority: "medium",
    assignee: "Theo Brandt",
    labels: ["infra"],
    updated: "Jul 22",
    description: [
      "Umbrella for the pieces that have to move together when the pipeline changes hosts.",
    ],
    activity: [],
  },
  {
    id: "atlas-3-a",
    key: "BYC-197",
    projectId: "atlas",
    parentId: "atlas-3",
    title: "spa",
    status: "todo",
    priority: "medium",
    assignee: "Theo Brandt",
    labels: [],
    updated: "Jul 22",
    description: ["Front end deploy target and its cache headers."],
    activity: [],
  },
  {
    id: "atlas-3-b",
    key: "BYC-196",
    projectId: "atlas",
    parentId: "atlas-3",
    title: "website",
    status: "todo",
    priority: "low",
    assignee: "Ines Faber",
    labels: [],
    updated: "Jul 22",
    description: ["Marketing site, still on the old bucket."],
    activity: [],
  },
  {
    id: "atlas-3-c",
    key: "BYC-195",
    projectId: "atlas",
    parentId: "atlas-3",
    title: "central-server",
    status: "todo",
    priority: "medium",
    assignee: UNASSIGNED,
    labels: [],
    updated: "Jul 22",
    description: ["The one piece that cannot take downtime."],
    activity: [],
  },
  {
    id: "atlas-4",
    key: "BYC-181",
    projectId: "atlas",
    title: "Cap retry concurrency at 8",
    status: "done",
    priority: "high",
    assignee: "Theo Brandt",
    labels: ["pipeline", "incident"],
    updated: "Jul 21",
    description: [
      "The retry storm from the batch job was enough to push ingest latency over threshold for six minutes.",
    ],
    activity: [
      {
        id: "atlas-4-a1",
        kind: "status",
        author: "Theo Brandt",
        time: "9d ago",
        detail: "moved from In Progress to Done",
      },
    ],
  },
  {
    id: "pricing-1",
    key: "BYC-212",
    projectId: "pricing",
    title: "Comparison table copy",
    status: "doing",
    priority: "high",
    assignee: "Nadia Alvi",
    labels: ["copy"],
    updated: "Jul 26",
    description: [
      "Plan names are locked: Starter, Team, Scale. The rows go in as they are, minus the adjectives.",
    ],
    activity: [
      {
        id: "pricing-1-a1",
        kind: "created",
        author: "Sam Okoro",
        time: "6d ago",
        detail: "created the task",
      },
    ],
  },
  {
    id: "pricing-2",
    key: "BYC-206",
    projectId: "pricing",
    title: "Annual toggle",
    status: "done",
    priority: "medium",
    assignee: "Ines Faber",
    labels: ["ui/ux"],
    updated: "Jul 24",
    description: ["Monthly and annual, with the saving shown per plan."],
    activity: [],
  },
  {
    id: "pricing-3",
    key: "BYC-203",
    projectId: "pricing",
    title: "Scopes instead of task priorities",
    status: "todo",
    priority: "low",
    assignee: UNASSIGNED,
    labels: ["ui/ux"],
    updated: "Jul 24",
    description: [
      "Priorities keep drifting. Scoping the work to a release might carry the same signal with less upkeep.",
    ],
    activity: [],
  },
  {
    id: "onboarding-1",
    key: "BYC-199",
    projectId: "onboarding",
    title: "Collapse steps 3 to 6",
    status: "doing",
    priority: "high",
    assignee: "Ines Faber",
    labels: ["ui/ux"],
    updated: "Jul 25",
    description: [
      "Nine steps become four. Three of the old ones only ever collected something we can infer.",
    ],
    activity: [
      {
        id: "onboarding-1-a1",
        kind: "comment",
        author: "Sam Okoro",
        time: "3d ago",
        body: "Study notes back up cutting step 5 entirely — nobody read it.",
      },
    ],
  },
  {
    id: "onboarding-2",
    key: "BYC-192",
    projectId: "onboarding",
    title: "Auth and multitenancy",
    status: "todo",
    priority: "urgent",
    assignee: "Theo Brandt",
    labels: ["infra"],
    updated: "Jul 22",
    description: [
      "One account can belong to several workspaces, so the first-run flow has to ask which one it is setting up.",
    ],
    activity: [],
  },
  {
    id: "onboarding-3",
    key: "BYC-188",
    projectId: "onboarding",
    title: "Skip-for-now path",
    status: "todo",
    priority: "none",
    assignee: UNASSIGNED,
    labels: [],
    updated: "Jul 20",
    description: [
      "Everything skipped has to be reachable from settings later.",
    ],
    activity: [],
  },
  {
    id: "mobile-1",
    key: "BYC-184",
    projectId: "mobile",
    title: "Offline draft store",
    status: "doing",
    priority: "medium",
    assignee: "Sam Okoro",
    labels: ["mobile"],
    updated: "Jul 21",
    description: [
      "Drafts survive a cold start. On conflict the local copy wins and the remote one is kept as a revision.",
    ],
    activity: [],
  },
  {
    id: "mobile-2",
    key: "BYC-176",
    projectId: "mobile",
    title: "Push notification permissions",
    status: "todo",
    priority: "low",
    assignee: UNASSIGNED,
    labels: ["mobile"],
    updated: "Jul 18",
    description: ["Ask on first mention, never at launch."],
    activity: [],
  },
]

export const MESSAGES: Record<string, ReadonlyArray<MockMessage>> = {
  "atlas-incidents": [
    {
      id: "atlas-incidents-1",
      author: "Nadia Alvi",
      time: "9:12 AM",
      day: "Today",
      body: "Standup moved to 10:30 for the rest of the week.",
    },
    {
      id: "atlas-incidents-2",
      author: "Theo Brandt",
      time: "9:20 AM",
      day: "Today",
      body: "Works for me. I will post notes in the thread after.",
    },
    {
      id: "atlas-incidents-3",
      author: "Reviewer",
      time: "9:41 AM",
      day: "Today",
      body: "Two of yesterday's pull requests still need a second pass.",
    },
  ],
  "pricing-launch": [
    {
      id: "pricing-launch-1",
      author: "Build",
      time: "6:04 PM",
      day: "Yesterday",
      body: "v2.13.4 is out. No rollbacks queued.",
    },
    {
      id: "pricing-launch-2",
      author: "Build",
      time: "7:02 AM",
      day: "Today",
      body: "v2.14.0 is on staging. Smoke suite green in 4m12s.",
    },
    {
      id: "pricing-launch-3",
      author: "Nadia Alvi",
      time: "8:15 AM",
      day: "Today",
      body: "Holding the production push until the pricing copy lands.",
    },
  ],
  "onboarding-research": [
    {
      id: "onboarding-research-1",
      author: "Pager",
      time: "2:44 AM",
      day: "Today",
      body: "Ingest latency over threshold for 6 minutes. Auto-resolved.",
    },
    {
      id: "onboarding-research-2",
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

export const DOCS: ReadonlyArray<MockDoc> = [
  {
    id: "atlas-cutover",
    projectId: "atlas",
    title: "Cutover runbook",
    summary:
      "Step-by-step for the night of the switch, with the rollback path.",
    author: "Theo Brandt",
    updated: "2 hours ago",
  },
  {
    id: "atlas-checkpoints",
    projectId: "atlas",
    title: "Checkpoint format",
    summary: "How ids are derived and why a second pass is a no-op.",
    author: "Nadia Alvi",
    updated: "Yesterday",
  },
  {
    id: "pricing-tiers",
    projectId: "pricing",
    title: "Tier comparison",
    summary: "What each plan includes, and the wording we settled on.",
    author: "Ines Faber",
    updated: "Jul 28",
  },
  {
    id: "onboarding-flow",
    projectId: "onboarding",
    title: "First-run flow",
    summary: "The four steps that replace the old nine, with the skip path.",
    author: "Ines Faber",
    updated: "Jul 26",
  },
  {
    id: "mobile-offline",
    projectId: "mobile",
    title: "Offline drafts",
    summary: "Where drafts live before they sync, and what wins on conflict.",
    author: "Sam Okoro",
    updated: "Jul 21",
  },
]

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

/** Favourites hold surfaces, never a single task — a task list stands in. */
export interface MockFavorite {
  view: Extract<CollaborationView, "project" | "tasks" | "channel">
  id: string
}

export const FAVORITES: ReadonlyArray<MockFavorite> = [
  { view: "channel", id: "atlas-dev" },
  { view: "tasks", id: "atlas" },
  { view: "tasks", id: "pricing" },
  { view: "project", id: "onboarding" },
]

/** Openers offered on the new-chat surface, in the order they are shown. */
export const CHAT_PROMPTS: ReadonlyArray<string> = [
  "Review the open pull requests on this branch",
  "Draft release notes from the last ten commits",
  "Plan the next task in Atlas rewrite",
]

export const projectChannels = (projectId: string) =>
  CHANNELS.filter((c) => c.projectId === projectId)

export const taskChildren = (taskId: string) =>
  TASKS.filter((t) => t.parentId === taskId)

export const projectTasks = (projectId: string) =>
  TASKS.filter((t) => t.projectId === projectId)

export const projectDocs = (projectId: string) =>
  DOCS.filter((d) => d.projectId === projectId)

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id)

export const findChannel = (id: string) => CHANNELS.find((c) => c.id === id)

export const findTask = (id: string) => TASKS.find((t) => t.id === id)

export const openTaskCount = (projectId: string) =>
  projectTasks(projectId).filter((t) => t.status !== "done").length
