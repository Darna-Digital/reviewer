/** Mock dependencies + fixtures for the cloud feature tests. */
import type {
  CloudConnection,
  CloudRepo,
  CloudRunSnapshot,
  CloudRunSummary,
  NewCloudRun,
} from "@byconvo/core/cloud";
import type { CloudDependencies } from "../interfaces/cloud.interfaces";

const AT = "2026-01-01T00:00:00.000Z";

export const cloudRepo = (overrides: Partial<CloudRepo> = {}): CloudRepo => ({
  id: "repo-1",
  hostId: "1",
  owner: "acme",
  name: "api",
  fullName: "acme/api",
  defaultBranch: "main",
  private: false,
  cloneUrl: "https://github.com/acme/api.git",
  htmlUrl: "https://github.com/acme/api",
  linkedAt: AT,
  ...overrides,
});

export const disconnected = (
  overrides: Partial<CloudConnection> = {}
): CloudConnection => ({
  serverUrl: "https://cloud.test",
  status: "disconnected",
  user: null,
  connectedAt: null,
  pending: null,
  ...overrides,
});

export const pending = (
  overrides: Partial<CloudConnection> = {}
): CloudConnection => ({
  serverUrl: "https://cloud.test",
  status: "pending",
  user: null,
  connectedAt: null,
  pending: {
    userCode: "ABCD-EFGH",
    verificationUri: "https://cloud.test/app/device",
    verificationUriComplete:
      "https://cloud.test/app/device?user_code=ABCD-EFGH",
    expiresAt: "2026-01-01T00:10:00.000Z",
    intervalMs: 5_000,
  },
  ...overrides,
});

export const connected = (
  overrides: Partial<CloudConnection> = {}
): CloudConnection => ({
  serverUrl: "https://cloud.test",
  status: "connected",
  user: {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    plan: "pro",
  },
  connectedAt: AT,
  pending: null,
  ...overrides,
});

export const cloudRunSnapshot = (
  overrides: Partial<CloudRunSnapshot["run"]> = {}
): CloudRunSnapshot => ({
  run: {
    id: "run-1",
    repoId: "repo-1",
    repoFullName: "acme/api",
    title: "Fix the build",
    provider: "claude",
    model: "",
    effort: "high",
    access: "fullAccess",
    baseBranch: "main",
    branch: "byconvo/fix-the-build-run1",
    sessionId: null,
    status: "queued",
    openPullRequest: true,
    pullRequestUrl: null,
    headSha: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  },
  turns: [],
  messages: [],
  activities: [],
  lastSeq: 0,
});

export const cloudRunSummary = (
  overrides: Partial<CloudRunSummary> = {}
): CloudRunSummary => ({
  id: "run-1",
  repoFullName: "acme/api",
  title: "Fix the build",
  provider: "claude",
  model: "",
  branch: "byconvo/fix-the-build-run1",
  status: "queued",
  pullRequestUrl: null,
  createdAt: AT,
  updatedAt: AT,
  turnCount: 1,
  lastMessage: "fix the build",
  ...overrides,
});

export interface CloudCalls {
  connect: string[];
  poll: number;
  disconnect: number;
  connectAgent: Array<"codex">;
  createRun: NewCloudRun[];
  send: Array<{ id: string; prompt: string }>;
  cancel: string[];
  delays: number[];
}

export function mockCloudDependencies(
  script: {
    /** Successive answers to `poll`; the last repeats. */
    polls?: ReadonlyArray<CloudConnection | Error>;
    /** The clock, as milliseconds since the epoch; advanced by each delay. */
    startAt?: number;
    /** True when this machine has already signed in to the agent's vendor. */
    agentAlreadySignedIn?: boolean;
  } = {}
): { deps: CloudDependencies; calls: CloudCalls } {
  const calls: CloudCalls = {
    connect: [],
    poll: 0,
    disconnect: 0,
    createRun: [],
    send: [],
    cancel: [],
    delays: [],
    connectAgent: [],
  };
  const polls = script.polls ?? [connected()];
  let clock = script.startAt ?? Date.parse("2026-01-01T00:00:00.000Z");
  const deps: CloudDependencies = {
    data: {},
    sideEffects: {
      connect: async (serverUrl) => {
        calls.connect.push(serverUrl);
        return pending({ serverUrl });
      },
      connectAgent: async (provider) => {
        calls.connectAgent.push(provider);
        return {
          provider,
          kind: script.agentAlreadySignedIn === true ? "reused" : "signed-in",
        };
      },
      poll: async () => {
        const answer = polls[Math.min(calls.poll, polls.length - 1)];
        calls.poll += 1;
        if (answer instanceof Error) throw answer;
        return answer ?? pending();
      },
      disconnect: async () => {
        calls.disconnect += 1;
        return disconnected();
      },
      createRun: async (input) => {
        calls.createRun.push(input);
        return cloudRunSnapshot({ id: `run-${calls.createRun.length}` });
      },
      send: async (id, prompt) => {
        calls.send.push({ id, prompt });
        return cloudRunSnapshot({ id });
      },
      cancel: async (id) => {
        calls.cancel.push(id);
        return cloudRunSnapshot({ id, status: "cancelled" });
      },
      delay: async (ms) => {
        calls.delays.push(ms);
        clock += ms;
      },
      now: () => clock,
    },
  };
  return { deps, calls };
}
