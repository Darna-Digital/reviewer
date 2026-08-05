/**
 * Prototype data for the collaboration mode — no API behind it yet.
 *
 * Projects own the tree: every task and every channel carries the project it
 * belongs to, so the sidebar can nest them and the panes can look either way
 * (project → its work, task/channel → its project) from the same arrays.
 */
import { agentShort } from "@/interactions/threads/interfaces/agents";
import type { AgentKind } from "@byconvo/core/threads";

export type CollaborationView =
  | "project"
  | "tasks"
  | "task"
  | "docs"
  | "channel"
  | "chat"
  | "agents"
  | "members";

export type TaskStatus = "todo" | "doing" | "review" | "done";

export const UNASSIGNED = "Unassigned";

export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";

export interface MockActivity {
  id: string;
  kind: "created" | "priority" | "status" | "comment";
  author: string;
  time: string;
  /** What happened, for everything but a comment. */
  detail?: string;
  /** The comment itself. */
  body?: string;
}

export interface MockTask {
  id: string;
  /** The short key the list and the header show, e.g. BYC-224. */
  key: string;
  projectId: string;
  /** Set on a sub-issue; the list nests it under its parent. */
  parentId?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  labels: ReadonlyArray<string>;
  updated: string;
  description: ReadonlyArray<string>;
  activity: ReadonlyArray<MockActivity>;
}

export interface MockDoc {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  author: string;
  updated: string;
}

export interface MockChannel {
  id: string;
  name: string;
  topic: string;
  unread: number;
  projectId?: string;
}

/**
 * A chat is public unless someone says otherwise: it lands in the workspace
 * database, every member of its project can open and read it, and joining is a
 * request the person who started it answers. Private is the exception, and the
 * only kind that stays out of a teammate's sidebar.
 */
export type ChatVisibility = "public" | "private";

/** Where the viewer stands with a chat they can already read. */
export type ChatMembership = "joined" | "open" | "requested";

export interface MockJoinRequest {
  id: string;
  person: string;
  note: string;
  asked: string;
}

export interface MockChat {
  id: string;
  projectId: string;
  title: string;
  visibility: ChatVisibility;
  /** Who started it, and so who answers the join requests. */
  initiator: string;
  members: ReadonlyArray<string>;
  /** The viewer's own outstanding ask, which only they ever see. */
  viewerRequested: boolean;
  requests: ReadonlyArray<MockJoinRequest>;
  /** Approved requests, replayed at the foot of the transcript. */
  joins: ReadonlyArray<{ id: string; person: string; time: string }>;
  updated: string;
  unread: number;
}

export interface MockProject {
  id: string;
  name: string;
  color: string;
  summary: string;
  lead: string;
  target: string;
}

export interface MockMessage {
  id: string;
  author: string;
  /** Set when an agent posted it, so the row can find whose agent that is. */
  agentId?: string;
  time: string;
  day: string;
  body: string;
}

export interface MockPerson {
  id: string;
  name: string;
  detail: string;
  online: boolean;
}

/** How much an agent may do before it stops to ask its owner. */
export type AgentAccess = "ask" | "edits" | "full";

export const ACCESS_LABEL: Record<AgentAccess, string> = {
  ask: "Ask every time",
  edits: "Approve edits",
  full: "Full access",
};

export const ACCESS_DETAIL: Record<AgentAccess, string> = {
  ask: "Every edit and command",
  edits: "Commands still ask",
  full: "Edits, commands, git",
};

/**
 * Where an agent's process actually lives. A local one is a CLI on somebody's
 * laptop, so only that person can bring it into a conversation; a cloud one runs
 * in the workspace and anyone here can call it. This is the line that decides
 * which agents a member may add to a chat.
 */
export type AgentRuntime = "local" | "cloud";

/**
 * An agent is one of the CLIs the code mode already runs, not a character: its
 * `kind` picks the brand mark and the vendor name, and it is either mid-turn or
 * idle rather than "online". The id is per-installation, not per-kind, because
 * two people can each run Claude in the same workspace.
 */
export interface MockAgent {
  id: string;
  kind: AgentKind;
  runtime: AgentRuntime;
  /** The person whose account the CLI runs under — the workspace, when cloud. */
  owner: string;
  detail: string;
  access: AgentAccess;
  running: boolean;
}

export interface MockWorkspace {
  id: string;
  name: string;
  detail: string;
  color: string;
}

export interface MockViewer {
  name: string;
  email: string;
}

export const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  "doing",
  "review",
  "todo",
  "done",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "In Progress",
  review: "In Review",
  done: "Done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

export const WORKSPACES: ReadonlyArray<MockWorkspace> = [
  {
    id: "darna",
    name: "Darna Digital HQ",
    detail: "12 members, 3 agents",
    color: "#7C8CF8",
  },
  {
    id: "hans",
    name: "Hans Natur",
    detail: "5 members, 1 agent",
    color: "#5BC0A8",
  },
  { id: "personal", name: "Personal", detail: "Just you", color: "#E2707F" },
];

/** Whoever is signed in — the account the workspace picker hangs off. */
export const VIEWER: MockViewer = {
  name: "Rūtenis Raila",
  email: "rutenis@darnadigital.com",
};

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
];

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
];

/** The owner a cloud agent carries, since no one person's machine runs it. */
export const WORKSPACE_OWNER = WORKSPACES[0]?.name ?? "Workspace";

const SEED_AGENTS: ReadonlyArray<MockAgent> = [
  {
    id: "claude-rutenis",
    kind: "claude",
    runtime: "local",
    owner: VIEWER.name,
    detail: "Reviewing the open pull requests on atlas-ingest",
    access: "edits",
    running: true,
  },
  {
    id: "codex-nadia",
    kind: "codex",
    runtime: "local",
    owner: "Nadia Alvi",
    detail: "Ran the release checklist for v2.14.0",
    access: "full",
    running: false,
  },
  {
    id: "cursor-theo",
    kind: "cursor",
    runtime: "local",
    owner: "Theo Brandt",
    detail: "Renamed the checkpoint helpers across the ingest package",
    access: "edits",
    running: false,
  },
  {
    id: "cloud-claude",
    kind: "claude",
    runtime: "cloud",
    owner: WORKSPACE_OWNER,
    detail: "Answers from the workspace docs and the task history",
    access: "ask",
    running: true,
  },
  {
    id: "cloud-opencode",
    kind: "opencode",
    runtime: "cloud",
    owner: WORKSPACE_OWNER,
    detail: "Runs the nightly checks nobody has to be awake for",
    access: "edits",
    running: false,
  },
];

/**
 * Added agents live here for the session, the same way created tasks do — the
 * seed is where the prototype starts and a reload is a fresh workspace.
 *
 * Unlike tasks this one publishes changes: pausing an agent has no navigation
 * to piggyback a re-render on, and the sidebar's state dot would otherwise
 * disagree with the pane that just changed it.
 */
let agents: ReadonlyArray<MockAgent> = SEED_AGENTS;
const agentListeners = new Set<() => void>();

/**
 * Not everything the panes read is an array they can compare — a conversation's
 * agent line-up is a record keyed by id — so every change bumps one counter and
 * the hooks watch that instead of guessing which reference moved.
 */
let revision = 0;

export const collaborationRevision = (): number => revision;

const emitAgents = () => {
  revision += 1;
  for (const listener of agentListeners) listener();
};

export const subscribeToAgents = (listener: () => void): (() => void) => {
  agentListeners.add(listener);
  return () => agentListeners.delete(listener);
};

export const allAgents = (): ReadonlyArray<MockAgent> => agents;

export const findAgentById = (id: string) => agents.find((a) => a.id === id);

export const findAgentByName = (name: string) =>
  agents.find((a) => agentName(a) === name);

/** Someone's first name, possessive — "Rūtenis'", "Nadia's". */
const possessive = (fullName: string) => {
  const first = fullName.split(" ")[0] ?? fullName;
  return first.endsWith("s") ? `${first}'` : `${first}'s`;
};

/**
 * An agent is named for whose it is, because two people can both run Claude and
 * "Claude Code" alone would not say which one just posted. A cloud agent belongs
 * to no one in particular, so it is named for the workspace instead.
 */
export const agentName = (agent: MockAgent): string =>
  agent.runtime === "cloud"
    ? `Workspace ${agentShort(agent.kind)}`
    : `${possessive(agent.owner)} ${agentShort(agent.kind)}`;

/** The owner as the UI shows them: their workspace role, or "You" for the viewer. */
export const agentOwner = (
  agent: MockAgent
): { name: string; detail: string; isViewer: boolean } => {
  const isViewer = agent.runtime === "local" && agent.owner === VIEWER.name;
  return {
    name: agent.owner,
    detail:
      agent.runtime === "cloud"
        ? "Shared by the workspace"
        : isViewer
          ? "You"
          : (MEMBERS.find((m) => m.name === agent.owner)?.detail ?? ""),
    isViewer,
  };
};

/** Where the agent runs, as the hover card and the pickers say it. */
export const RUNTIME_LABEL: Record<AgentRuntime, string> = {
  local: "On a machine",
  cloud: "In the cloud",
};

export const runtimeLine = (agent: MockAgent): string => {
  if (agent.runtime === "cloud") {
    return "Runs in the workspace cloud. Anyone here can bring it into a conversation.";
  }
  return agent.owner === VIEWER.name
    ? "Runs on your machine and posts as you. Only you can bring it into a conversation."
    : `Runs on ${agent.owner.split(" ")[0]}'s machine. Only they can bring it into a conversation.`;
};

/**
 * What a given member may add to a conversation: whatever runs on their own
 * machine, plus every cloud agent the workspace shares. A teammate's local CLI
 * is theirs to invite, never yours.
 */
export const callableBy = (person: string): ReadonlyArray<MockAgent> =>
  agents.filter((a) => a.runtime === "cloud" || a.owner === person);

/** The badge an agent's own messages carry, naming whose account posted them. */
export const managedBy = (agentId: string): string => {
  const agent = findAgentById(agentId);
  if (agent === undefined) return "";
  if (agent.runtime === "cloud") return "runs in the cloud";
  return agent.owner === VIEWER.name
    ? "managed by you"
    : `managed by ${agent.owner.split(" ")[0]}`;
};

export interface AgentDraft {
  kind: AgentKind;
  runtime: AgentRuntime;
  owner: string;
  detail: string;
  access: AgentAccess;
}

/** Ids read as kind + owner, so a second Claude cannot collide with the first. */
export function addAgent(draft: AgentDraft): MockAgent {
  const suffix =
    draft.runtime === "cloud"
      ? "cloud"
      : (draft.owner.split(" ")[0]?.toLowerCase() ?? "new");
  const created: MockAgent = {
    id: `${draft.kind}-${suffix}`,
    kind: draft.kind,
    runtime: draft.runtime,
    owner: draft.runtime === "cloud" ? WORKSPACE_OWNER : draft.owner,
    detail: draft.detail.trim() === "" ? "Not run yet" : draft.detail.trim(),
    access: draft.access,
    running: false,
  };
  agents = [...agents, created];
  emitAgents();
  return created;
}

export function removeAgent(id: string): void {
  agents = agents.filter((a) => a.id !== id);
  emitAgents();
}

export function setAgentRunning(id: string, running: boolean): void {
  agents = agents.map((a) => (a.id === id ? { ...a, running } : a));
  emitAgents();
}

/** One person cannot install the same CLI twice — the picker greys these out. */
export const ownerHasAgent = (owner: string, kind: AgentKind): boolean =>
  agents.some((a) => a.owner === owner && a.kind === kind);

const SEED_CHATS: ReadonlyArray<MockChat> = [
  {
    id: "atlas-retry",
    projectId: "atlas",
    title: "Retry storm postmortem",
    visibility: "public",
    initiator: VIEWER.name,
    members: [VIEWER.name, "Nadia Alvi"],
    requests: [
      {
        id: "atlas-retry-r1",
        person: "Sam Okoro",
        note: "Writing the incident summary — I would rather read the thread than the write-up.",
        asked: "18 minutes ago",
      },
      {
        id: "atlas-retry-r2",
        person: "Ines Faber",
        note: "",
        asked: "1 hour ago",
      },
    ],
    viewerRequested: false,
    joins: [],
    updated: "11:04 AM",
    unread: 2,
  },
  {
    id: "atlas-rehearsal",
    projectId: "atlas",
    title: "Cutover rehearsal plan",
    visibility: "public",
    initiator: "Theo Brandt",
    members: ["Theo Brandt", "Nadia Alvi"],
    requests: [],
    viewerRequested: false,
    joins: [],
    updated: "9:52 AM",
    unread: 0,
  },
  {
    id: "pricing-wording",
    projectId: "pricing",
    title: "Comparison table wording",
    visibility: "public",
    initiator: "Nadia Alvi",
    members: ["Nadia Alvi", "Sam Okoro", VIEWER.name],
    requests: [],
    viewerRequested: false,
    joins: [],
    updated: "1:47 PM",
    unread: 1,
  },
  {
    id: "onboarding-cuts",
    projectId: "onboarding",
    title: "Which steps actually go",
    visibility: "private",
    initiator: "Ines Faber",
    members: ["Ines Faber", VIEWER.name],
    requests: [],
    viewerRequested: false,
    joins: [],
    updated: "Yesterday",
    unread: 0,
  },
  {
    id: "mobile-conflicts",
    projectId: "mobile",
    title: "Offline draft conflicts",
    visibility: "public",
    initiator: "Sam Okoro",
    members: ["Sam Okoro"],
    requests: [],
    viewerRequested: false,
    joins: [],
    updated: "Yesterday",
    unread: 0,
  },
];

/**
 * Chats and their agent line-ups change from inside the panes — joining,
 * approving, bringing an agent in — so both publish, the way agents do. The
 * agent line-up is keyed by conversation id and covers channels too: a public
 * channel takes agents on exactly the same terms a chat does.
 */
let chats: ReadonlyArray<MockChat> = SEED_CHATS;

const SEED_CONVERSATION_AGENTS: Record<string, ReadonlyArray<string>> = {
  "atlas-retry": ["claude-rutenis", "cloud-claude"],
  "atlas-rehearsal": ["cursor-theo", "cloud-opencode"],
  "pricing-wording": ["codex-nadia", "cloud-claude"],
  "onboarding-cuts": ["cloud-claude"],
  "mobile-conflicts": [],
  "atlas-incidents": ["claude-rutenis", "cloud-opencode"],
  "atlas-dev": ["claude-rutenis"],
  "pricing-launch": ["codex-nadia"],
  "onboarding-research": ["cloud-claude"],
};

let conversationAgents: Record<
  string,
  ReadonlyArray<string>
> = SEED_CONVERSATION_AGENTS;

const chatListeners = new Set<() => void>();

const emitChats = () => {
  revision += 1;
  for (const listener of chatListeners) listener();
};

export const subscribeToChats = (listener: () => void): (() => void) => {
  chatListeners.add(listener);
  return () => chatListeners.delete(listener);
};

export const allChats = (): ReadonlyArray<MockChat> => chats;

export const findChat = (id: string) => chats.find((c) => c.id === id);

/** A private chat is invisible to anyone outside it; a public one is not. */
export const visibleChats = (projectId: string): ReadonlyArray<MockChat> =>
  chats.filter(
    (c) =>
      c.projectId === projectId &&
      (c.visibility === "public" || c.members.includes(VIEWER.name))
  );

export const membershipOf = (chat: MockChat): ChatMembership =>
  chat.members.includes(VIEWER.name)
    ? "joined"
    : chat.viewerRequested
      ? "requested"
      : "open";

const setViewerRequested = (chatId: string, viewerRequested: boolean) => {
  chats = chats.map((chat) =>
    chat.id === chatId ? { ...chat, viewerRequested } : chat
  );
  emitChats();
};

export function requestToJoin(chatId: string): void {
  setViewerRequested(chatId, true);
}

export function withdrawJoinRequest(chatId: string): void {
  setViewerRequested(chatId, false);
}

const nowTime = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function approveJoinRequest(chatId: string, requestId: string): void {
  chats = chats.map((chat) => {
    if (chat.id !== chatId) return chat;
    const request = chat.requests.find((r) => r.id === requestId);
    if (request === undefined) return chat;
    return {
      ...chat,
      members: [...chat.members, request.person],
      requests: chat.requests.filter((r) => r.id !== requestId),
      joins: [
        ...chat.joins,
        { id: requestId, person: request.person, time: nowTime() },
      ],
    };
  });
  emitChats();
}

export function declineJoinRequest(chatId: string, requestId: string): void {
  chats = chats.map((chat) =>
    chat.id === chatId
      ? { ...chat, requests: chat.requests.filter((r) => r.id !== requestId) }
      : chat
  );
  emitChats();
}

export const agentsIn = (conversationId: string): ReadonlyArray<MockAgent> =>
  (conversationAgents[conversationId] ?? [])
    .map((id) => findAgentById(id))
    .filter((agent) => agent !== undefined);

const setConversationAgents = (
  conversationId: string,
  ids: ReadonlyArray<string>
) => {
  conversationAgents = { ...conversationAgents, [conversationId]: ids };
  emitChats();
};

export function addAgentToConversation(
  conversationId: string,
  agentId: string
): void {
  const current = conversationAgents[conversationId] ?? [];
  if (current.includes(agentId)) return;
  setConversationAgents(conversationId, [...current, agentId]);
}

export function removeAgentFromConversation(
  conversationId: string,
  agentId: string
): void {
  const current = conversationAgents[conversationId] ?? [];
  setConversationAgents(
    conversationId,
    current.filter((id) => id !== agentId)
  );
}

/** Seed rows name their agent through the same helper the UI uses. */
const seedAgentName = (id: string): string => {
  const agent = SEED_AGENTS.find((a) => a.id === id);
  return agent === undefined ? "" : agentName(agent);
};

const SEED_TASKS: ReadonlyArray<MockTask> = [
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
        author: seedAgentName("claude-rutenis"),
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
    assignee: seedAgentName("cursor-theo"),
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
];

export const MESSAGES: Record<string, ReadonlyArray<MockMessage>> = {
  "atlas-retry": [
    {
      id: "atlas-retry-1",
      author: VIEWER.name,
      time: "10:31 AM",
      day: "Today",
      body: "Pulling the postmortem together. The 2:44 page is the one I cannot account for yet.",
    },
    {
      id: "atlas-retry-2",
      author: seedAgentName("claude-rutenis"),
      agentId: "claude-rutenis",
      time: "10:33 AM",
      day: "Today",
      body: "The batch job opened 64 connections against a pool of 8. Every failure re-queued instantly, so the retries outnumbered first attempts four to one for six minutes.",
    },
    {
      id: "atlas-retry-3",
      author: "Nadia Alvi",
      time: "10:47 AM",
      day: "Today",
      body: "That matches the graph. Capping concurrency held it, but the instant re-queue is still there.",
    },
    {
      id: "atlas-retry-4",
      author: seedAgentName("cloud-claude"),
      agentId: "cloud-claude",
      time: "11:04 AM",
      day: "Today",
      body: "Two earlier incidents in this workspace name the same cause — BYC-181 and the June pager thread. Both closed on a concurrency cap and neither added backoff.",
    },
  ],
  "atlas-rehearsal": [
    {
      id: "atlas-rehearsal-1",
      author: "Theo Brandt",
      time: "9:02 AM",
      day: "Today",
      body: "Two dry runs before Thursday. First one tonight against the shadow queue, second Wednesday with the real read path.",
    },
    {
      id: "atlas-rehearsal-2",
      author: seedAgentName("cursor-theo"),
      agentId: "cursor-theo",
      time: "9:14 AM",
      day: "Today",
      body: "The runbook still points at the old worker for step 4. I can rewrite that step against the new ingest path.",
    },
    {
      id: "atlas-rehearsal-3",
      author: "Nadia Alvi",
      time: "9:52 AM",
      day: "Today",
      body: "Do it, then paste the diff here before it goes into the doc.",
    },
  ],
  "pricing-wording": [
    {
      id: "pricing-wording-1",
      author: "Nadia Alvi",
      time: "1:10 PM",
      day: "Today",
      body: "Rows are locked. What is left is whether we say seats or members.",
    },
    {
      id: "pricing-wording-2",
      author: seedAgentName("codex-nadia"),
      agentId: "codex-nadia",
      time: "1:12 PM",
      day: "Today",
      body: "The app says members everywhere except billing, which says seats. Nine files use members, two use seats.",
    },
    {
      id: "pricing-wording-3",
      author: "Sam Okoro",
      time: "1:29 PM",
      day: "Today",
      body: "Members on the page, seats on the invoice. Nobody reads both in one sitting.",
    },
    {
      id: "pricing-wording-4",
      author: seedAgentName("cloud-claude"),
      agentId: "cloud-claude",
      time: "1:47 PM",
      day: "Today",
      body: "Then the comparison table needs one edit — row 3 currently reads “per seat”.",
    },
  ],
  "onboarding-cuts": [
    {
      id: "onboarding-cuts-1",
      author: "Ines Faber",
      time: "4:20 PM",
      day: "Yesterday",
      body: "Keeping this one between us until the numbers hold up. Steps 5 and 7 are the ones I want to cut.",
    },
    {
      id: "onboarding-cuts-2",
      author: seedAgentName("cloud-claude"),
      agentId: "cloud-claude",
      time: "4:26 PM",
      day: "Yesterday",
      body: "Step 5 collects the team size, which the invite flow already knows. Step 7 is the only one asking for something we never read again.",
    },
  ],
  "mobile-conflicts": [
    {
      id: "mobile-conflicts-1",
      author: "Sam Okoro",
      time: "5:11 PM",
      day: "Yesterday",
      body: "Local copy wins and the remote one is kept as a revision. Writing it down before I forget why.",
    },
    {
      id: "mobile-conflicts-2",
      author: "Sam Okoro",
      time: "5:14 PM",
      day: "Yesterday",
      body: "The awkward case is two devices offline at once. Last write in still wins, which is wrong but rare.",
    },
  ],
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
      author: seedAgentName("claude-rutenis"),
      agentId: "claude-rutenis",
      time: "9:41 AM",
      day: "Today",
      body: "Reviewed the four pull requests opened yesterday. Two still need a second pass — both touch the retry path.",
    },
  ],
  "pricing-launch": [
    {
      id: "pricing-launch-1",
      author: seedAgentName("codex-nadia"),
      agentId: "codex-nadia",
      time: "6:04 PM",
      day: "Yesterday",
      body: "Release run for v2.13.4 finished. No rollbacks queued.",
    },
    {
      id: "pricing-launch-2",
      author: seedAgentName("codex-nadia"),
      agentId: "codex-nadia",
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
      author: seedAgentName("claude-rutenis"),
      agentId: "claude-rutenis",
      time: "9:02 AM",
      day: "Today",
      body: "The writer skips checkpoint ids it has already committed, so a repeat run is a no-op.",
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
};

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
];

export const MEMBERS: ReadonlyArray<MockPerson> = [
  { id: "nadia", name: "Nadia Alvi", detail: "Engineering lead", online: true },
  { id: "theo", name: "Theo Brandt", detail: "Backend", online: true },
  { id: "ines", name: "Ines Faber", detail: "Design", online: false },
  { id: "sam", name: "Sam Okoro", detail: "Product", online: false },
];

/** What an unqualified `/modes/collaboration` shows — the lead project. */
export const DEFAULT_VIEW: CollaborationView = "project";
export const DEFAULT_ID = PROJECTS[0]?.id ?? "";

/** Favourites hold surfaces, never a single task — a task list stands in. */
export interface MockFavorite {
  view: Extract<CollaborationView, "project" | "tasks" | "channel">;
  id: string;
}

export const FAVORITES: ReadonlyArray<MockFavorite> = [
  { view: "channel", id: "atlas-dev" },
  { view: "tasks", id: "atlas" },
  { view: "tasks", id: "pricing" },
  { view: "project", id: "onboarding" },
];

/** Openers offered on the new-chat surface, in the order they are shown. */
export const CHAT_PROMPTS: ReadonlyArray<string> = [
  "Review the open pull requests on this branch",
  "Draft release notes from the last ten commits",
  "Plan the next task in Atlas rewrite",
];

/**
 * The seed above is where the prototype starts; anything created in the app is
 * appended here. It lives in memory only — a reload is a fresh workspace, which
 * is the right trade for a surface with no backend behind it yet.
 */
let tasks: ReadonlyArray<MockTask> = SEED_TASKS;

export const allTasks = (): ReadonlyArray<MockTask> => tasks;

export interface TaskDraft {
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  description: string;
}

/** Keys run BYC-nnn across the whole workspace, so the next one is the max +1. */
const nextTaskKey = (): string => {
  const highest = tasks.reduce((top, task) => {
    const n = Number(task.key.split("-")[1]);
    return Number.isFinite(n) ? Math.max(top, n) : top;
  }, 0);
  return `BYC-${highest + 1}`;
};

export function addTask(draft: TaskDraft): MockTask {
  const key = nextTaskKey();
  const created: MockTask = {
    id: `task-${key.toLowerCase()}`,
    key,
    projectId: draft.projectId,
    title: draft.title,
    status: draft.status,
    priority: draft.priority,
    assignee: draft.assignee,
    labels: [],
    updated: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    description: draft.description.trim() === "" ? [] : [draft.description],
    activity: [
      {
        id: `${key}-created`,
        kind: "created",
        author: VIEWER.name,
        time: "just now",
      },
    ],
  };
  tasks = [created, ...tasks];
  return created;
}

export const projectChannels = (projectId: string) =>
  CHANNELS.filter((c) => c.projectId === projectId);

export const taskChildren = (taskId: string) =>
  tasks.filter((t) => t.parentId === taskId);

export const projectTasks = (projectId: string) =>
  tasks.filter((t) => t.projectId === projectId);

export const projectDocs = (projectId: string) =>
  DOCS.filter((d) => d.projectId === projectId);

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id);

export const findChannel = (id: string) => CHANNELS.find((c) => c.id === id);

export const findTask = (id: string) => tasks.find((t) => t.id === id);

export const openTaskCount = (projectId: string) =>
  projectTasks(projectId).filter((t) => t.status !== "done").length;
