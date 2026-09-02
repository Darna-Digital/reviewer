/**
 * The cloud service — the app's one connection to byconvo cloud, and every
 * call that goes over it.
 *
 * Connecting is the OAuth device flow: `connect` asks the cloud for a code and
 * remembers it as pending, the SPA shows the person the code and opens the
 * browser, and `poll` asks whether they have approved yet — until the cloud
 * answers with a token, or says the code lapsed or was refused. The token is
 * kept by the repository and handed to every later call here; nothing above
 * this service ever sees it, except the SSE proxy through `credentials`.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { CloudApi, type CloudApiError } from "../../../ports/cloud-api.ts";
import type { StorageError } from "../../../shared.ts";
import { CloudNotConnected } from "../errors.ts";
import {
  deviceExpiresAt,
  normalizeServerUrl,
} from "../functions/cloud.functions.ts";
import {
  CloudSettingsRepository,
  type CloudSettingsRepo,
  type StoredCloudConnection,
} from "../repository/cloud.repository.ts";
import type {
  CloudConnection,
  CloudRepo,
  CloudRunSnapshot,
  CloudRunSummary,
  NewCloudRun,
} from "../schema/cloud.schema.ts";

export const DEFAULT_CLOUD_SERVER_URL = "https://api.byconvo.com";

export type CloudFailure = StorageError | CloudApiError | CloudNotConnected;

/** What the SSE proxy needs to open a stream in the user's name. */
export interface CloudCredentials {
  readonly serverUrl: string;
  readonly token: string;
}

export interface CloudServiceShape {
  /** The connection as the SPA may see it — never the token. */
  readonly status: Effect.Effect<CloudConnection, StorageError>;
  /** Start the device flow against `serverUrl`; the result is `pending`. */
  readonly connect: (
    serverUrl: string
  ) => Effect.Effect<CloudConnection, StorageError | CloudApiError>;
  /**
   * One poll of the pending device flow. A token connects; a lapsed or
   * refused code goes back to disconnected; anything else leaves the
   * connection as it was.
   */
  readonly poll: Effect.Effect<CloudConnection, StorageError | CloudApiError>;
  readonly disconnect: Effect.Effect<CloudConnection, StorageError>;
  readonly repos: Effect.Effect<ReadonlyArray<CloudRepo>, CloudFailure>;
  readonly runs: Effect.Effect<ReadonlyArray<CloudRunSummary>, CloudFailure>;
  readonly run: (id: string) => Effect.Effect<CloudRunSnapshot, CloudFailure>;
  readonly createRun: (
    input: NewCloudRun
  ) => Effect.Effect<CloudRunSnapshot, CloudFailure>;
  readonly send: (
    id: string,
    prompt: string
  ) => Effect.Effect<CloudRunSnapshot, CloudFailure>;
  readonly cancel: (
    id: string
  ) => Effect.Effect<CloudRunSnapshot, CloudFailure>;
  /** Internal — for the SSE proxy. Not exposed over HTTP. */
  readonly credentials: Effect.Effect<
    CloudCredentials,
    StorageError | CloudNotConnected
  >;
}

export class CloudService extends Context.Service<
  CloudService,
  CloudServiceShape
>()("CloudService") {}

const DISCONNECTED: CloudConnection = {
  serverUrl: DEFAULT_CLOUD_SERVER_URL,
  status: "disconnected",
  user: null,
  connectedAt: null,
  pending: null,
};

/** The stored row as the SPA may see it. */
export const publicConnection = (
  stored: StoredCloudConnection | null
): CloudConnection => {
  if (stored === null) return DISCONNECTED;
  if (stored.token !== null) {
    return {
      serverUrl: stored.serverUrl,
      status: "connected",
      user: stored.user,
      connectedAt: stored.connectedAt,
      pending: null,
    };
  }
  if (stored.pendingDeviceCode !== null && stored.pending !== null) {
    return {
      serverUrl: stored.serverUrl,
      status: "pending",
      user: null,
      connectedAt: null,
      pending: stored.pending,
    };
  }
  return { ...DISCONNECTED, serverUrl: stored.serverUrl };
};

const disconnected = (serverUrl: string): StoredCloudConnection => ({
  serverUrl,
  token: null,
  pendingDeviceCode: null,
  pending: null,
  user: null,
  connectedAt: null,
});

export const makeCloudService = Effect.gen(function* () {
  const repo: CloudSettingsRepo = yield* CloudSettingsRepository;
  const api = yield* CloudApi;

  const status = Effect.map(repo.read, publicConnection);

  const credentials: CloudServiceShape["credentials"] = Effect.flatMap(
    repo.read,
    (stored) =>
      stored === null || stored.token === null
        ? Effect.fail(
            new CloudNotConnected({
              reason:
                "byconvo is not connected to byconvo cloud — connect in Settings",
            })
          )
        : Effect.succeed({ serverUrl: stored.serverUrl, token: stored.token })
  );

  /** Run `f` with the stored credentials, once there are some. */
  const withCredentials = <A>(
    f: (serverUrl: string, token: string) => Effect.Effect<A, CloudApiError>
  ): Effect.Effect<A, CloudFailure> =>
    Effect.flatMap(credentials, ({ serverUrl, token }) => f(serverUrl, token));

  const connect: CloudServiceShape["connect"] = (input) =>
    Effect.gen(function* () {
      const serverUrl = normalizeServerUrl(input);
      const target =
        serverUrl.length > 0 ? serverUrl : DEFAULT_CLOUD_SERVER_URL;
      const grant = yield* api.startDevice(target);
      const stored = yield* repo.write({
        ...disconnected(target),
        pendingDeviceCode: grant.deviceCode,
        pending: {
          userCode: grant.userCode,
          verificationUri: grant.verificationUri,
          verificationUriComplete: grant.verificationUriComplete,
          expiresAt: deviceExpiresAt(grant.expiresIn, new Date()),
          intervalMs: Math.max(1, grant.interval) * 1_000,
        },
      });
      return publicConnection(stored);
    });

  const poll: CloudServiceShape["poll"] = Effect.gen(function* () {
    const stored = yield* repo.read;
    // Nothing pending — connected already, or never started — is nothing to
    // poll, and says so by handing back the connection as it is.
    if (stored === null || stored.pendingDeviceCode === null) {
      return publicConnection(stored);
    }
    const answer = yield* api.pollDevice(
      stored.serverUrl,
      stored.pendingDeviceCode
    );
    switch (answer.kind) {
      case "pending":
      case "slow-down":
        return publicConnection(stored);
      case "denied":
      case "expired":
        return publicConnection(
          yield* repo.write(disconnected(stored.serverUrl))
        );
      case "token": {
        const user = yield* api.me(stored.serverUrl, answer.token);
        const connected = yield* repo.write({
          serverUrl: stored.serverUrl,
          token: answer.token,
          pendingDeviceCode: null,
          pending: null,
          user,
          connectedAt: new Date().toISOString(),
        });
        return publicConnection(connected);
      }
    }
  });

  const disconnect: CloudServiceShape["disconnect"] = Effect.gen(function* () {
    const stored = yield* repo.read;
    const serverUrl = stored?.serverUrl ?? DEFAULT_CLOUD_SERVER_URL;
    return publicConnection(yield* repo.write(disconnected(serverUrl)));
  });

  const service: CloudServiceShape = {
    status,
    connect,
    poll,
    disconnect,
    repos: withCredentials(api.repos),
    runs: withCredentials(api.listRuns),
    run: (id) => withCredentials((url, token) => api.getRun(url, token, id)),
    createRun: (input) =>
      withCredentials((url, token) => api.createRun(url, token, input)),
    send: (id, prompt) =>
      withCredentials((url, token) =>
        api.sendRunMessage(url, token, id, prompt)
      ),
    cancel: (id) =>
      withCredentials((url, token) => api.cancelRun(url, token, id)),
    credentials,
  };

  return CloudService.of(service);
});
