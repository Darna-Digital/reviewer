/**
 * Wire shapes for the cloud feature — reviewer's connection to reviewer cloud,
 * and the runs that connection can start and follow.
 *
 * The run shapes mirror the cloud's own (`@reviewer-cloud/core/runs`,
 * `/repos`, `/identity`) field for field: the two repositories are separate,
 * so the shapes are copied rather than imported, and kept in the cloud's
 * naming so a JSON body from one decodes with the other's schema unchanged.
 *
 * The connection itself never carries the bearer token. What the SPA sees is
 * where the app is connected, who as, and — mid device flow — the code to
 * type; the token stays in the local store behind `CloudSettingsRepository`.
 */
import * as Schema from "effect/Schema";

// --- The connection -------------------------------------------------------

export const CloudConnectionStatus = Schema.Literals([
  "disconnected",
  "pending",
  "connected",
]);
export type CloudConnectionStatus = typeof CloudConnectionStatus.Type;

export const CloudPlan = Schema.Literals(["free", "pro", "team"]);
export type CloudPlan = typeof CloudPlan.Type;

/** The cloud's `Viewer`: who the token belongs to, and their plan. */
export const CloudViewer = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: Schema.NullOr(Schema.String),
  plan: CloudPlan,
});
export type CloudViewer = typeof CloudViewer.Type;

/** The device flow in progress: what to show the person, and how to poll. */
export const CloudPendingDevice = Schema.Struct({
  userCode: Schema.String,
  verificationUri: Schema.String,
  verificationUriComplete: Schema.String,
  /** When the code stops being accepted, ISO. */
  expiresAt: Schema.String,
  /** How long to wait between polls, as the server asked. */
  intervalMs: Schema.Number,
});
export type CloudPendingDevice = typeof CloudPendingDevice.Type;

export const CloudConnection = Schema.Struct({
  serverUrl: Schema.String,
  status: CloudConnectionStatus,
  user: Schema.NullOr(CloudViewer),
  connectedAt: Schema.NullOr(Schema.String),
  pending: Schema.NullOr(CloudPendingDevice),
});
export type CloudConnection = typeof CloudConnection.Type;

export const ConnectCloud = Schema.Struct({ serverUrl: Schema.String });
export type ConnectCloud = typeof ConnectCloud.Type;

// --- Repositories ---------------------------------------------------------

/** The cloud's `LinkedRepo`: a repository the user runs agents in. */
export const CloudRepo = Schema.Struct({
  id: Schema.String,
  hostId: Schema.String,
  owner: Schema.String,
  name: Schema.String,
  fullName: Schema.String,
  defaultBranch: Schema.String,
  private: Schema.Boolean,
  cloneUrl: Schema.String,
  htmlUrl: Schema.String,
  linkedAt: Schema.String,
});
export type CloudRepo = typeof CloudRepo.Type;

// --- Runs -----------------------------------------------------------------

export const CloudRunProvider = Schema.Literals([
  "claude",
  "codex",
  "opencode",
  "cursor",
]);
export type CloudRunProvider = typeof CloudRunProvider.Type;

export const CloudRunEffort = Schema.Literals(["low", "medium", "high"]);
export type CloudRunEffort = typeof CloudRunEffort.Type;

export const CloudRunAccess = Schema.Literals([
  "supervised",
  "acceptEdits",
  "fullAccess",
]);
export type CloudRunAccess = typeof CloudRunAccess.Type;

/**
 * Where the run is, as one word. `idle` is a run whose last turn settled and
 * is waiting for the next prompt; `failed` and `cancelled` are the same but
 * say how the last one ended.
 */
export const CloudRunStatus = Schema.Literals([
  "queued",
  "provisioning",
  "running",
  "idle",
  "failed",
  "cancelled",
]);
export type CloudRunStatus = typeof CloudRunStatus.Type;

export const CloudTurnState = Schema.Literals([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type CloudTurnState = typeof CloudTurnState.Type;

export const CloudRun = Schema.Struct({
  id: Schema.String,
  repoId: Schema.String,
  repoFullName: Schema.String,
  title: Schema.String,
  provider: CloudRunProvider,
  model: Schema.String,
  effort: CloudRunEffort,
  access: CloudRunAccess,
  baseBranch: Schema.String,
  branch: Schema.String,
  sessionId: Schema.NullOr(Schema.String),
  status: CloudRunStatus,
  openPullRequest: Schema.Boolean,
  pullRequestUrl: Schema.NullOr(Schema.String),
  headSha: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type CloudRun = typeof CloudRun.Type;

export const CloudRunTurn = Schema.Struct({
  id: Schema.String,
  runId: Schema.String,
  seq: Schema.Number,
  prompt: Schema.String,
  state: CloudTurnState,
  attempts: Schema.Number,
  runnerId: Schema.NullOr(Schema.String),
  leaseUntil: Schema.NullOr(Schema.String),
  cancelRequested: Schema.Boolean,
  resultText: Schema.NullOr(Schema.String),
  errorMessage: Schema.NullOr(Schema.String),
  totalCostUsd: Schema.NullOr(Schema.Number),
  createdAt: Schema.String,
  startedAt: Schema.NullOr(Schema.String),
  endedAt: Schema.NullOr(Schema.String),
});
export type CloudRunTurn = typeof CloudRunTurn.Type;

export const CloudRunActivity = Schema.Struct({
  id: Schema.String,
  turnId: Schema.String,
  kind: Schema.String,
  tone: Schema.Literals(["info", "tool", "error"]),
  summary: Schema.String,
  detail: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  callId: Schema.optionalKey(Schema.String),
  label: Schema.optionalKey(Schema.String),
});
export type CloudRunActivity = typeof CloudRunActivity.Type;

/** One line of the run's log — flat, so a client switches on `kind`. */
export const CloudRunEventPayload = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("turn-queued"),
    prompt: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("turn-started") }),
  Schema.Struct({
    kind: Schema.Literal("status"),
    status: CloudRunStatus,
    detail: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("log"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("delta"), text: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("activity"),
    activity: CloudRunActivity,
  }),
  Schema.Struct({
    kind: Schema.Literal("turn-completed"),
    state: CloudTurnState,
    text: Schema.String,
    errorMessage: Schema.NullOr(Schema.String),
    totalCostUsd: Schema.NullOr(Schema.Number),
  }),
  Schema.Struct({
    kind: Schema.Literal("published"),
    branch: Schema.String,
    headSha: Schema.NullOr(Schema.String),
    pullRequestUrl: Schema.NullOr(Schema.String),
  }),
]);
export type CloudRunEventPayload = typeof CloudRunEventPayload.Type;

export const CloudRunEvent = Schema.Struct({
  /** Position in the run's log, from 1, dense. */
  seq: Schema.Number,
  runId: Schema.String,
  turnId: Schema.String,
  at: Schema.String,
  payload: CloudRunEventPayload,
});
export type CloudRunEvent = typeof CloudRunEvent.Type;

export const CloudRunMessage = Schema.Struct({
  id: Schema.String,
  turnId: Schema.String,
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String,
  streaming: Schema.Boolean,
  createdAt: Schema.String,
});
export type CloudRunMessage = typeof CloudRunMessage.Type;

/** A run as a client holds it: the record plus everything folded from its log. */
export const CloudRunSnapshot = Schema.Struct({
  run: CloudRun,
  turns: Schema.Array(CloudRunTurn),
  messages: Schema.Array(CloudRunMessage),
  activities: Schema.Array(CloudRunActivity),
  /** The last event folded in — where a stream should resume from. */
  lastSeq: Schema.Number,
});
export type CloudRunSnapshot = typeof CloudRunSnapshot.Type;

export const CloudRunSummary = Schema.Struct({
  id: Schema.String,
  repoFullName: Schema.String,
  title: Schema.String,
  provider: CloudRunProvider,
  model: Schema.String,
  branch: Schema.String,
  status: CloudRunStatus,
  pullRequestUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  turnCount: Schema.Number,
  lastMessage: Schema.NullOr(Schema.String),
});
export type CloudRunSummary = typeof CloudRunSummary.Type;

export const NewCloudRun = Schema.Struct({
  repoId: Schema.String,
  prompt: Schema.String,
  provider: Schema.optionalKey(CloudRunProvider),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(CloudRunEffort),
  access: Schema.optionalKey(CloudRunAccess),
  /** Defaults to the repository's default branch. */
  baseBranch: Schema.optionalKey(Schema.String),
  /** Defaults to a branch named after the prompt. */
  branch: Schema.optionalKey(Schema.String),
  openPullRequest: Schema.optionalKey(Schema.Boolean),
});
export type NewCloudRun = typeof NewCloudRun.Type;

export const SendCloudRunMessage = Schema.Struct({ prompt: Schema.String });
export type SendCloudRunMessage = typeof SendCloudRunMessage.Type;

export const CloudRunIdParam = Schema.Struct({ id: Schema.String });

/**
 * How an agent's subscription reached the cloud: `reused` when this machine
 * was already signed in, `signed-in` when a browser was opened for it.
 */
export const CloudAgentConnected = Schema.Struct({
  provider: Schema.Literals(["codex"]),
  kind: Schema.Literals(["reused", "signed-in"]),
});
export type CloudAgentConnected = typeof CloudAgentConnected.Type;

export const CloudAgentParam = Schema.Struct({
  provider: Schema.Literals(["codex"]),
});
