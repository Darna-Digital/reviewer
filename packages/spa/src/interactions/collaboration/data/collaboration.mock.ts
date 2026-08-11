/**
 * Prototype data for the collaboration mode — no API behind it yet.
 *
 * Projects own the tree: every task and every chat carries the project it
 * belongs to, so the sidebar can nest them and the panes can look either way
 * (project → its work, task/chat → its project) from the same arrays.
 */
import {
  laneTasks,
  pushInto,
  type Displacement,
} from "@/interactions/collaboration/functions/task-flow.functions";
import { agentShort } from "@/interactions/threads/interfaces/agents";
import type { AgentKind } from "@byconvo/core/threads";

export type CollaborationView =
  | "project"
  | "tasks"
  | "flow"
  | "outlook"
  | "task"
  | "docs"
  | "chat"
  | "agents"
  | "members";

/**
 * `figuring` is the honest one. A task nobody has worked out yet is not "todo"
 * and not "in progress" — somebody is spending real time deciding what the work
 * even is, and the board should say so rather than let it sit in a lane that
 * implies the shape is known.
 */
export type TaskStatus = "todo" | "figuring" | "doing" | "review" | "done";

export const UNASSIGNED = "Unassigned";

/**
 * A horizon, not a rank. Work is either in a stretch of time or it is out of
 * scope; there is no "high priority" to hide behind, because a horizon has an
 * end and a rank does not.
 */
export type ScopeKind =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "duration"
  | "out";

export interface MockScope {
  id: string;
  kind: ScopeKind;
  name: string;
  /** The dates it covers, spelled out. */
  window: string;
  /** What is left of it, as a person would say it aloud. */
  left: string;
  /**
   * How many things somebody said this horizon holds. A decision about how much
   * to take on, never a guess at how long anything takes — which is why work
   * can be pushed out of it without an estimate existing anywhere.
   */
  capacity: number | null;
  /** How far through the horizon we already are, 0–1. */
  elapsed: number;
}

/**
 * What a task turned out to be, as opposed to what somebody thought it was.
 *
 * Discovery is the most common event in software and no tracker has a verb for
 * it, so people record it as a slipped date instead. Here it is a first-class
 * entry: something was found, and it either split off work of its own, made
 * this task bigger, or turned a settled thing back into a question.
 */
export type DiscoveryEffect = "split" | "grew" | "question";

export interface MockDiscovery {
  id: string;
  found: string;
  by: string;
  when: string;
  effect: DiscoveryEffect;
  /** The task it spawned, when it split off. */
  spawned?: string;
}

export interface MockActivity {
  id: string;
  kind: "created" | "scope" | "status" | "comment";
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
  /** Which horizon it sits in. */
  scopeId: string;
  /** Its place in that horizon. Only one task can be first. */
  sequence: number;
  /** Tasks that have to land before this one can start. */
  blockedBy: ReadonlyArray<string>;
  /** Minutes actually tracked. Never an estimate — this is only ever the past. */
  spent: number;
  /**
   * Minutes the task sat unable to move. Kept apart from time worked, because
   * "three weeks" is usually six hours of work and nineteen days of waiting,
   * and only one of those is anybody's speed.
   */
  waited: number;
  /**
   * How many times it has been moved to a later horizon. The honest version of
   * a slipped date: nobody has to have estimated anything for this to be true.
   */
  pushes: number;
  /** What was learned while doing it. */
  discoveries: ReadonlyArray<MockDiscovery>;
  /**
   * Set on a bug that exists because another task was not actually finished.
   * Landing is not the same as being done, and this is how the difference shows.
   */
  symptomOf?: string;
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
  "figuring",
  "doing",
  "review",
  "todo",
  "done",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  figuring: "Figuring out",
  doing: "In Progress",
  review: "In Review",
  done: "Done",
};

export const STATUS_MEANING: Record<TaskStatus, string> = {
  todo: "Nobody has started.",
  figuring: "Somebody is working out what the work is.",
  doing: "The work itself is under way.",
  review: "Written, waiting on someone else to look.",
  done: "Landed.",
};

/**
 * The horizons, nearest first. A dynamic one slots in by when it ends, so
 * "Cutover window" sits between this week and this month without anybody
 * choosing where to file it. `out` is last and belongs to no timeline.
 */
export const SCOPES: ReadonlyArray<MockScope> = [
  {
    id: "today",
    kind: "day",
    name: "Today",
    window: "Tue 11 Aug",
    left: "5 hours left",
    capacity: 4,
    elapsed: 0.58,
  },
  {
    id: "week",
    kind: "week",
    name: "This week",
    window: "Mon 10 – Sun 16 Aug",
    left: "4 days left",
    capacity: 3,
    elapsed: 0.3,
  },
  {
    id: "cutover",
    kind: "duration",
    name: "Cutover window",
    window: "Sun 17 – Fri 22 Aug",
    left: "starts in 6 days",
    capacity: 2,
    elapsed: 0,
  },
  {
    id: "month",
    kind: "month",
    name: "This month",
    window: "August",
    left: "20 days left",
    capacity: 4,
    elapsed: 0.34,
  },
  {
    id: "quarter",
    kind: "quarter",
    name: "This quarter",
    window: "Jul – Sep",
    left: "7 weeks left",
    capacity: 6,
    elapsed: 0.51,
  },
  {
    id: "out",
    kind: "out",
    name: "Out of scope",
    window: "No horizon",
    left: "Nobody is waiting on these",
    capacity: null,
    elapsed: 0,
  },
];

export const findScope = (id: string) => SCOPES.find((s) => s.id === id);

/** Where a scope sits on the timeline; an unknown one lands at the end. */
export const scopeRank = (id: string): number => {
  const at = SCOPES.findIndex((s) => s.id === id);
  return at < 0 ? SCOPES.length : at;
};

export const DEFAULT_SCOPE = SCOPES[1]?.id ?? "week";

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
 * agent line-up is keyed by conversation id.
 */
let chats: ReadonlyArray<MockChat> = SEED_CHATS;

const SEED_CONVERSATION_AGENTS: Record<string, ReadonlyArray<string>> = {
  "atlas-retry": ["claude-rutenis", "cloud-claude"],
  "atlas-rehearsal": ["cursor-theo", "cloud-opencode"],
  "pricing-wording": ["codex-nadia", "cloud-claude"],
  "onboarding-cuts": ["cloud-claude"],
  "mobile-conflicts": [],
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
    scopeId: "today",
    sequence: 1,
    blockedBy: [],
    spent: 380,
    waited: 0,
    pushes: 1,
    discoveries: [
      {
        id: "atlas-1-d1",
        found:
          "Compaction reads the checkpoint table without a transaction, so the drain cannot run alongside it.",
        by: "Theo Brandt",
        when: "2d ago",
        effect: "split",
        spawned: "atlas-5",
      },
      {
        id: "atlas-1-d2",
        found:
          "The shadow queue has 40 minutes of backlog nobody accounted for.",
        by: "Theo Brandt",
        when: "1d ago",
        effect: "grew",
      },
    ],
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
        kind: "scope",
        author: "Nadia Alvi",
        time: "2d ago",
        detail: "pulled this into Today, first",
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
    scopeId: "today",
    sequence: 2,
    blockedBy: ["atlas-1"],
    spent: 95,
    waited: 2760,
    pushes: 2,
    discoveries: [
      {
        id: "atlas-2-d1",
        found:
          "The dry-run window was a week short, so the first pass proved less than we thought.",
        by: VIEWER.name,
        when: "1d ago",
        effect: "grew",
      },
    ],
    assignee: VIEWER.name,
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
      {
        id: "atlas-2-a3",
        kind: "comment",
        author: "Nadia Alvi",
        time: "2h ago",
        body: "Handing this to you — the dry run is clean, so it is the second pass and the sign-off left.",
      },
      {
        id: "atlas-2-a4",
        kind: "comment",
        author: "Theo Brandt",
        time: "1h ago",
        body: "One ask before it runs: sequence it after the drain, not alongside. Compaction reads the checkpoint table without a transaction.",
      },
    ],
  },
  {
    id: "atlas-3",
    key: "BYC-193",
    projectId: "atlas",
    title: "Web infra",
    status: "todo",
    scopeId: "month",
    sequence: 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "month",
    sequence: 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "month",
    sequence: 2,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "month",
    sequence: 3,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "week",
    sequence: 3,
    blockedBy: [],
    spent: 185,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "today",
    sequence: 1,
    blockedBy: [],
    spent: 130,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
      {
        id: "pricing-1-a2",
        kind: "status",
        author: "Nadia Alvi",
        time: "Yesterday",
        detail: "moved from Todo to In Progress",
      },
      {
        id: "pricing-1-a3",
        kind: "comment",
        author: "Nadia Alvi",
        time: "Yesterday",
        body: "Taking the copy pass myself. The Scale column is the only one with rows still in question.",
      },
    ],
  },
  {
    id: "pricing-2",
    key: "BYC-206",
    projectId: "pricing",
    title: "Annual toggle",
    status: "done",
    scopeId: "week",
    sequence: 1,
    blockedBy: [],
    spent: 220,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    status: "figuring",
    scopeId: "month",
    sequence: 1,
    blockedBy: [],
    spent: 60,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "week",
    sequence: 2,
    blockedBy: ["onboarding-2"],
    spent: 265,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
      {
        id: "onboarding-1-a2",
        kind: "comment",
        author: "Ines Faber",
        time: "4h ago",
        body: "@Rūtenis the four-step version is in the design doc. Does the second screen still need the workspace name, or can we infer it from the invite?",
      },
    ],
  },
  {
    id: "onboarding-2",
    key: "BYC-192",
    projectId: "onboarding",
    title: "Auth and multitenancy",
    status: "figuring",
    scopeId: "week",
    sequence: 1,
    blockedBy: [],
    spent: 90,
    waited: 0,
    pushes: 3,
    discoveries: [
      {
        id: "onboarding-2-d1",
        found:
          "One account can belong to several workspaces, which the invite flow never had to know.",
        by: "Theo Brandt",
        when: "6d ago",
        effect: "grew",
      },
      {
        id: "onboarding-2-d2",
        found:
          "Whether a workspace can be created during first run is still open.",
        by: "Ines Faber",
        when: "3d ago",
        effect: "question",
      },
    ],
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
    scopeId: "out",
    sequence: 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
    scopeId: "week",
    sequence: 1,
    blockedBy: [],
    spent: 310,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: "Sam Okoro",
    labels: ["mobile"],
    updated: "Jul 21",
    description: [
      "Drafts survive a cold start. On conflict the local copy wins and the remote one is kept as a revision.",
    ],
    activity: [
      {
        id: "mobile-1-a1",
        kind: "comment",
        author: "Sam Okoro",
        time: "Yesterday",
        body: "Conflict rule is written but untested against a cold start mid-sync. If you have a device on the beta build, that is the case I cannot reproduce.",
      },
    ],
  },
  {
    id: "mobile-2",
    key: "BYC-176",
    projectId: "mobile",
    title: "Push notification permissions",
    status: "todo",
    scopeId: "out",
    sequence: 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: UNASSIGNED,
    labels: ["mobile"],
    updated: "Jul 18",
    description: ["Ask on first mention, never at launch."],
    activity: [],
  },
  {
    id: "atlas-5",
    key: "BYC-231",
    projectId: "atlas",
    title: "Why compaction reads without a transaction",
    status: "figuring",
    scopeId: "today",
    sequence: 3,
    blockedBy: [],
    spent: 45,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: VIEWER.name,
    labels: ["pipeline"],
    updated: "Aug 11",
    description: [
      "Not a task yet — a question. Either the read is safe because compaction only ever trails the drain, or it is not and the sequencing has to be enforced rather than agreed.",
      "It sits in Today because the answer decides whether BYC-218 can run tonight, not because anyone thinks it is an hour of work.",
    ],
    activity: [
      {
        id: "atlas-5-a1",
        kind: "status",
        author: VIEWER.name,
        time: "45m ago",
        detail: "moved from Todo to Figuring out",
      },
    ],
  },
  {
    id: "atlas-11",
    key: "BYC-232",
    projectId: "atlas",
    title: "Point runbook step 4 at the new ingest path",
    status: "todo",
    scopeId: "today",
    sequence: 4,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: UNASSIGNED,
    labels: ["cutover", "docs"],
    updated: "Aug 11",
    description: [
      "One link and one paragraph. Nobody holds it and nothing is in its way, so it is there for whoever gets to it first.",
    ],
    activity: [],
  },
  {
    id: "atlas-6",
    key: "BYC-228",
    projectId: "atlas",
    title: "Second dry run against the real read path",
    status: "todo",
    scopeId: "week",
    sequence: 1,
    blockedBy: ["atlas-2"],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: "Theo Brandt",
    labels: ["cutover"],
    updated: "Aug 8",
    description: ["The first one was against the shadow queue."],
    activity: [],
  },
  {
    id: "atlas-7",
    key: "BYC-226",
    projectId: "atlas",
    title: "Retire the old worker",
    status: "todo",
    scopeId: "week",
    sequence: 2,
    blockedBy: ["atlas-8"],
    spent: 0,
    waited: 5760,
    pushes: 2,
    discoveries: [],
    assignee: "Nadia Alvi",
    labels: ["pipeline"],
    updated: "Aug 7",
    description: [
      "Nothing writes to it after the switch, so this is deleting the deployment and its alarms.",
    ],
    activity: [],
  },
  {
    id: "atlas-8",
    key: "BYC-235",
    projectId: "atlas",
    title: "Freeze writes and switch the read path",
    status: "figuring",
    scopeId: "cutover",
    sequence: 1,
    blockedBy: ["atlas-1"],
    spent: 70,
    waited: 0,
    pushes: 0,
    discoveries: [
      {
        id: "atlas-8-d1",
        found:
          "Nobody has written down who calls the freeze or what the read path does while it holds.",
        by: "Theo Brandt",
        when: "2d ago",
        effect: "question",
      },
    ],
    assignee: "Theo Brandt",
    labels: ["cutover"],
    updated: "Aug 9",
    description: [
      "The freeze window is the part nobody has written down yet — how long, who calls it, and what the read path does while it holds.",
    ],
    activity: [],
  },
  {
    id: "pricing-4",
    key: "BYC-233",
    projectId: "pricing",
    title: "Enterprise tier and the contact-us path",
    status: "figuring",
    scopeId: "quarter",
    sequence: 1,
    blockedBy: ["pricing-1"],
    spent: 55,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: "Sam Okoro",
    labels: ["copy"],
    updated: "Aug 6",
    description: [
      "Nobody has decided whether this is a plan on the page or a form behind it.",
    ],
    activity: [],
  },
  {
    id: "onboarding-4",
    key: "BYC-230",
    projectId: "onboarding",
    title: "Rework the invite flow around workspaces",
    status: "todo",
    scopeId: "quarter",
    sequence: 1,
    blockedBy: ["onboarding-2"],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: UNASSIGNED,
    labels: ["ui/ux"],
    updated: "Aug 5",
    description: ["Follows whatever multitenancy turns out to be."],
    activity: [],
  },
  {
    id: "mobile-3",
    key: "BYC-221",
    projectId: "mobile",
    title: "Native shell for iOS",
    status: "figuring",
    scopeId: "quarter",
    sequence: 2,
    blockedBy: [],
    spent: 120,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: "Sam Okoro",
    labels: ["mobile"],
    updated: "Jul 31",
    description: [
      "The wrapper is decided; what it wraps on a cold start is not.",
    ],
    activity: [],
  },
  {
    id: "atlas-9",
    key: "BYC-171",
    projectId: "atlas",
    title: "Rewrite the checkpoint format doc",
    status: "todo",
    scopeId: "out",
    sequence: 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: UNASSIGNED,
    labels: ["docs"],
    updated: "Jul 14",
    description: [
      "Worth doing, in nobody's horizon. It sits here instead of at the bottom of a list pretending to be low priority.",
    ],
    activity: [],
  },
  {
    id: "atlas-12",
    key: "BYC-236",
    projectId: "atlas",
    title: "Duplicate rows after a retry storm",
    status: "doing",
    scopeId: "today",
    sequence: 5,
    blockedBy: [],
    spent: 55,
    waited: 0,
    pushes: 0,
    discoveries: [
      {
        id: "atlas-12-d1",
        found:
          "The cap held the storm but never added backoff, so retries still overlap on the same checkpoint.",
        by: "Nadia Alvi",
        when: "3h ago",
        effect: "grew",
      },
    ],
    symptomOf: "atlas-4",
    assignee: "Nadia Alvi",
    labels: ["pipeline", "incident"],
    updated: "Aug 11",
    description: [
      "Not a new bug so much as the old one still being true. BYC-181 landed three weeks ago and this is the second thing to come back out of it.",
    ],
    activity: [],
  },
  {
    id: "atlas-10",
    key: "BYC-179",
    projectId: "atlas",
    title: "Shadow-run the drain for a full week",
    status: "done",
    scopeId: "week",
    sequence: 4,
    blockedBy: [],
    spent: 240,
    waited: 0,
    pushes: 0,
    discoveries: [],
    assignee: "Nadia Alvi",
    labels: ["pipeline"],
    updated: "Jul 30",
    description: ["Seven passes, no duplicate writes."],
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
  view: Extract<CollaborationView, "project" | "tasks" | "flow">;
  id: string;
}

export const FAVORITES: ReadonlyArray<MockFavorite> = [
  { view: "flow", id: "atlas" },
  { view: "tasks", id: "atlas" },
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

const taskListeners = new Set<() => void>();

const emitTasks = () => {
  revision += 1;
  for (const listener of taskListeners) listener();
};

export const subscribeToTasks = (listener: () => void): (() => void) => {
  taskListeners.add(listener);
  return () => taskListeners.delete(listener);
};

export const allTasks = (): ReadonlyArray<MockTask> => tasks;

export interface TaskDraft {
  projectId: string;
  title: string;
  status: TaskStatus;
  scopeId: string;
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
  const lane = laneTasks(tasks, draft.projectId, draft.scopeId);
  const created: MockTask = {
    id: `task-${key.toLowerCase()}`,
    key,
    projectId: draft.projectId,
    title: draft.title,
    status: draft.status,
    scopeId: draft.scopeId,
    sequence: lane.length + 1,
    blockedBy: [],
    spent: 0,
    waited: 0,
    pushes: 0,
    discoveries: [],
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
  emitTasks();
  return created;
}

/**
 * Drag lands here: a horizon and a position, which is the whole of planning.
 * It answers with whatever it had to push out of the way, because that is the
 * part a person needs to see and agree to.
 */
let undoable: ReadonlyArray<MockTask> | null = null;

export function moveTaskTo(
  taskId: string,
  scopeId: string,
  index: number
): ReadonlyArray<Displacement> {
  const before = tasks;
  const moved = tasks.find((task) => task.id === taskId);
  const result = pushInto(tasks, taskId, scopeId, index);
  if (result.tasks === tasks) return [];

  const outward = new Set(result.displaced.map((move) => move.task.id));
  if (moved !== undefined && scopeRank(scopeId) > scopeRank(moved.scopeId)) {
    outward.add(taskId);
  }

  undoable = before;
  tasks = result.tasks.map((task) =>
    outward.has(task.id) ? { ...task, pushes: task.pushes + 1 } : task
  );
  emitTasks();
  return result.displaced;
}

/** The verb no tracker has: something turned up that nobody knew about. */
export function recordDiscovery(
  taskId: string,
  found: string,
  effect: DiscoveryEffect
): void {
  const trimmed = found.trim();
  if (trimmed === "") return;
  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: effect === "question" ? "figuring" : task.status,
          discoveries: [
            ...task.discoveries,
            {
              id: `${task.id}-d${task.discoveries.length + 1}`,
              found: trimmed,
              by: VIEWER.name,
              when: "just now",
              effect,
            },
          ],
        }
      : task
  );
  emitTasks();
}

/** Time is a memory, not a timesheet — so it can be corrected without ceremony. */
export function adjustSpent(taskId: string, minutes: number): void {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, spent: Math.max(0, minutes) } : task
  );
  emitTasks();
}

export function undoLastMove(): void {
  if (undoable === null) return;
  tasks = undoable;
  undoable = null;
  emitTasks();
}

/** Taking something nobody holds. The only way work gets an owner here. */
export function claimTask(taskId: string): void {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, assignee: VIEWER.name } : task
  );
  emitTasks();
}

export function setTaskStatus(taskId: string, status: TaskStatus): void {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, status } : task
  );
  emitTasks();
}

/**
 * One clock, because a person only works on one thing at a time. Starting
 * somewhere else stops what was running and banks what it cost, so the total on
 * a task is always time somebody actually spent rather than time they meant to.
 */
let tracking: { taskId: string; startedAt: number } | null = null;

export const trackingNow = (): { taskId: string; startedAt: number } | null =>
  tracking;

const bankTracked = () => {
  if (tracking === null) return;
  const minutes = Math.round((Date.now() - tracking.startedAt) / 60_000);
  const { taskId } = tracking;
  tracking = null;
  if (minutes <= 0) return;
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, spent: task.spent + minutes } : task
  );
};

export function toggleTracking(taskId: string): void {
  const wasTracking = tracking?.taskId === taskId;
  bankTracked();
  if (!wasTracking) tracking = { taskId, startedAt: Date.now() };
  emitTasks();
}

export const taskChildren = (taskId: string) =>
  tasks.filter((t) => t.parentId === taskId);

export const projectTasks = (projectId: string) =>
  tasks.filter((t) => t.projectId === projectId);

export const projectDocs = (projectId: string) =>
  DOCS.filter((d) => d.projectId === projectId);

export const findProject = (id: string) => PROJECTS.find((p) => p.id === id);

export const findTask = (id: string) => tasks.find((t) => t.id === id);

export const openTaskCount = (projectId: string) =>
  projectTasks(projectId).filter((t) => t.status !== "done").length;
