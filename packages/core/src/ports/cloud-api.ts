/**
 * byconvo cloud as the local app calls it: the device flow that hands out a
 * bearer token, and the authenticated endpoints behind it.
 *
 * A port because the service that uses it has rules worth testing without a
 * network — what a pending poll leaves untouched, what a denial clears — and
 * the memory layer answers with a script while recording what was asked.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type {
  CloudRepo,
  CloudRunSnapshot,
  CloudRunSummary,
  CloudViewer,
  NewCloudRun,
} from "../features/cloud/schema/cloud.schema.ts";

/** The cloud answered badly, or not at all. `reason` is its own wording. */
export class CloudApiError extends Schema.TaggedErrorClass<CloudApiError>()(
  "CloudApiError",
  { reason: Schema.String, status: Schema.optionalKey(Schema.Number) },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason;
  }
}

/** What `POST /api/auth/device/code` hands back. */
export interface DeviceCodeGrant {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete: string;
  /** Seconds until the code lapses. */
  readonly expiresIn: number;
  /** Seconds between polls. */
  readonly interval: number;
}

/** One poll of the device flow, as the four RFC 8628 answers plus success. */
export type DevicePollResult =
  | { readonly kind: "pending" }
  | { readonly kind: "slow-down" }
  | { readonly kind: "denied" }
  | { readonly kind: "expired" }
  | { readonly kind: "token"; readonly token: string };

export interface CloudApiShape {
  readonly startDevice: (
    serverUrl: string
  ) => Effect.Effect<DeviceCodeGrant, CloudApiError>;
  readonly pollDevice: (
    serverUrl: string,
    deviceCode: string
  ) => Effect.Effect<DevicePollResult, CloudApiError>;
  readonly me: (
    serverUrl: string,
    token: string
  ) => Effect.Effect<CloudViewer, CloudApiError>;
  readonly repos: (
    serverUrl: string,
    token: string
  ) => Effect.Effect<ReadonlyArray<CloudRepo>, CloudApiError>;
  readonly listRuns: (
    serverUrl: string,
    token: string
  ) => Effect.Effect<ReadonlyArray<CloudRunSummary>, CloudApiError>;
  readonly getRun: (
    serverUrl: string,
    token: string,
    id: string
  ) => Effect.Effect<CloudRunSnapshot, CloudApiError>;
  readonly createRun: (
    serverUrl: string,
    token: string,
    input: NewCloudRun
  ) => Effect.Effect<CloudRunSnapshot, CloudApiError>;
  readonly sendRunMessage: (
    serverUrl: string,
    token: string,
    id: string,
    prompt: string
  ) => Effect.Effect<CloudRunSnapshot, CloudApiError>;
  readonly cancelRun: (
    serverUrl: string,
    token: string,
    id: string
  ) => Effect.Effect<CloudRunSnapshot, CloudApiError>;
  /**
   * Store an agent credential in the cloud, so its sandboxes can run that
   * agent on the person's own subscription. What `codex login` wrote here is
   * what the cloud's runs are given.
   */
  readonly setCredential: (
    serverUrl: string,
    token: string,
    input: { readonly kind: string; readonly secret: string }
  ) => Effect.Effect<void, CloudApiError>;
}

export class CloudApi extends Context.Service<CloudApi, CloudApiShape>()(
  "CloudApi"
) {}

// --- Memory ---------------------------------------------------------------

export const MEMORY_DEVICE_GRANT: DeviceCodeGrant = {
  deviceCode: "device-code-1",
  userCode: "ABCD-EFGH",
  verificationUri: "https://cloud.test/app/device",
  verificationUriComplete: "https://cloud.test/app/device?user_code=ABCD-EFGH",
  expiresIn: 600,
  interval: 5,
};

export const MEMORY_VIEWER: CloudViewer = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  image: null,
  plan: "pro",
};

/** What the memory cloud answers with. Every field has a quiet default. */
export interface MemoryCloudApiScript {
  readonly grant?: DeviceCodeGrant;
  /**
   * The answers to successive polls, in order; the last one repeats. Defaults
   * to a token straight away.
   */
  readonly polls?: ReadonlyArray<DevicePollResult>;
  readonly viewer?: CloudViewer;
  readonly repos?: ReadonlyArray<CloudRepo>;
  readonly runs?: ReadonlyArray<CloudRunSummary>;
  readonly snapshot?: (id: string) => CloudRunSnapshot;
  /** Fail every authenticated call this way — a revoked token, say. */
  readonly failure?: CloudApiError;
}

export interface MemoryCloudApiCalls {
  readonly setCredential: Array<{
    serverUrl: string;
    token: string;
    kind: string;
    secret: string;
  }>;
  readonly startDevice: Array<{ serverUrl: string }>;
  readonly pollDevice: Array<{ serverUrl: string; deviceCode: string }>;
  readonly me: Array<{ serverUrl: string; token: string }>;
  readonly repos: Array<{ serverUrl: string; token: string }>;
  readonly listRuns: Array<{ serverUrl: string; token: string }>;
  readonly getRun: Array<{ serverUrl: string; token: string; id: string }>;
  readonly createRun: Array<{
    serverUrl: string;
    token: string;
    input: NewCloudRun;
  }>;
  readonly sendRunMessage: Array<{
    serverUrl: string;
    token: string;
    id: string;
    prompt: string;
  }>;
  readonly cancelRun: Array<{ serverUrl: string; token: string; id: string }>;
}

const memorySnapshot = (id: string): CloudRunSnapshot => ({
  run: {
    id,
    repoId: "repo-1",
    repoFullName: "acme/api",
    title: "New run",
    provider: "claude",
    model: "",
    effort: "high",
    access: "fullAccess",
    baseBranch: "main",
    branch: `byconvo/${id}`,
    sessionId: null,
    status: "queued",
    openPullRequest: true,
    pullRequestUrl: null,
    headSha: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  turns: [],
  messages: [],
  activities: [],
  lastSeq: 0,
});

/** A scripted cloud, with every call it was asked on record. */
export const memoryCloudApi = (script: MemoryCloudApiScript = {}) => {
  const calls: MemoryCloudApiCalls = {
    startDevice: [],
    pollDevice: [],
    me: [],
    repos: [],
    listRuns: [],
    getRun: [],
    createRun: [],
    sendRunMessage: [],
    cancelRun: [],
    setCredential: [],
  };
  const polls = script.polls ?? [{ kind: "token", token: "token-1" }];
  let pollIndex = 0;
  const snapshot = script.snapshot ?? memorySnapshot;
  let runCounter = 0;

  const authed = <A>(value: () => A): Effect.Effect<A, CloudApiError> =>
    script.failure === undefined
      ? Effect.sync(value)
      : Effect.fail(script.failure);

  const api: CloudApiShape = {
    startDevice: (serverUrl) => {
      calls.startDevice.push({ serverUrl });
      return Effect.succeed(script.grant ?? MEMORY_DEVICE_GRANT);
    },
    pollDevice: (serverUrl, deviceCode) => {
      calls.pollDevice.push({ serverUrl, deviceCode });
      const answer = polls[Math.min(pollIndex, polls.length - 1)] ?? {
        kind: "pending",
      };
      pollIndex += 1;
      return Effect.succeed(answer);
    },
    me: (serverUrl, token) => {
      calls.me.push({ serverUrl, token });
      return authed(() => script.viewer ?? MEMORY_VIEWER);
    },
    repos: (serverUrl, token) => {
      calls.repos.push({ serverUrl, token });
      return authed(() => script.repos ?? []);
    },
    listRuns: (serverUrl, token) => {
      calls.listRuns.push({ serverUrl, token });
      return authed(() => script.runs ?? []);
    },
    getRun: (serverUrl, token, id) => {
      calls.getRun.push({ serverUrl, token, id });
      return authed(() => snapshot(id));
    },
    createRun: (serverUrl, token, input) => {
      calls.createRun.push({ serverUrl, token, input });
      return authed(() => {
        runCounter += 1;
        const created = snapshot(`run-mem-${runCounter}`);
        return {
          ...created,
          run: {
            ...created.run,
            repoId: input.repoId,
            title: input.prompt.split("\n")[0] ?? "New run",
          },
        };
      });
    },
    sendRunMessage: (serverUrl, token, id, prompt) => {
      calls.sendRunMessage.push({ serverUrl, token, id, prompt });
      return authed(() => snapshot(id));
    },
    cancelRun: (serverUrl, token, id) => {
      calls.cancelRun.push({ serverUrl, token, id });
      return authed(() => {
        const current = snapshot(id);
        return { ...current, run: { ...current.run, status: "cancelled" } };
      });
    },
    setCredential: (serverUrl, token, input) => {
      calls.setCredential.push({ serverUrl, token, ...input });
      return authed(() => undefined);
    },
  };

  const layer: Layer.Layer<CloudApi> = Layer.succeed(CloudApi)(
    CloudApi.of(api)
  );
  return { layer, calls };
};

export const memoryLayer = (
  script: MemoryCloudApiScript = {}
): Layer.Layer<CloudApi> => memoryCloudApi(script).layer;
