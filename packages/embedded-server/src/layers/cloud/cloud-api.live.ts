/**
 * byconvo cloud over `fetch`.
 *
 * Every call is JSON in and JSON out under a bearer token, and every answer
 * that is not 2xx is the cloud's own `{ _tag, reason }` — kept as the reason
 * of a `CloudApiError`, so what the person reads is what the cloud said. The
 * device flow's token endpoint is the one exception: it answers 400 with an
 * OAuth `error` code that is not a failure but a state, and is mapped to one.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  CloudRepo,
  CloudRunSnapshot,
  CloudRunSummary,
  CloudViewer,
} from "@byconvo/core/cloud";
import {
  CloudApi,
  CloudApiError,
  type CloudApiShape,
  type DeviceCodeGrant,
  type DevicePollResult,
} from "@byconvo/core/ports/cloud-api";

/** The client id the cloud's device-authorization plugin knows us by. */
export const DEVICE_CLIENT_ID = "byconvo-desktop";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const DeviceCodeResponse = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.optionalKey(Schema.String),
  expires_in: Schema.Number,
  interval: Schema.optionalKey(Schema.Number),
});

const DeviceTokenResponse = Schema.Struct({ access_token: Schema.String });

const DeviceTokenFailure = Schema.Struct({
  error: Schema.String,
  error_description: Schema.optionalKey(Schema.String),
});

/** The cloud's error body, or its status line when there is none. */
export const cloudReason = (status: number, body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "reason" in parsed &&
      typeof parsed.reason === "string"
    ) {
      return (parsed as { reason: string }).reason;
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      return (parsed as { message: string }).message;
    }
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const trimmed = body.trim();
  return trimmed.length > 0
    ? trimmed.slice(0, 300)
    : `byconvo cloud answered ${status}`;
};

/** Headers for an authenticated JSON request. */
export const cloudHeaders = (
  token: string | null,
  body: boolean
): Record<string, string> => ({
  accept: "application/json",
  ...(body ? { "content-type": "application/json" } : {}),
  ...(token === null ? {} : { authorization: `Bearer ${token}` }),
});

interface Response {
  readonly status: number;
  readonly body: string;
}

const failure = (reason: string, status?: number) =>
  new CloudApiError(status === undefined ? { reason } : { reason, status });

/** One request, with the network's own failure named as the cloud's. */
const request = (
  url: string,
  init: { method: string; token: string | null; body?: unknown }
): Effect.Effect<Response, CloudApiError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: init.method,
        headers: cloudHeaders(init.token, init.body !== undefined),
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      return { status: response.status, body: await response.text() };
    },
    catch: (error) =>
      failure(
        `could not reach byconvo cloud at ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`
      ),
  });

const decodeWith =
  <A>(schema: Schema.Codec<A, unknown>) =>
  (response: Response): Effect.Effect<A, CloudApiError> => {
    if (response.status < 200 || response.status >= 300) {
      return Effect.fail(
        failure(cloudReason(response.status, response.body), response.status)
      );
    }
    return Effect.try({
      try: () => Schema.decodeUnknownSync(schema)(JSON.parse(response.body)),
      catch: (error) =>
        failure(
          `byconvo cloud answered with something unexpected: ${
            error instanceof Error ? error.message : String(error)
          }`,
          response.status
        ),
    });
  };

const json = <A>(
  schema: Schema.Codec<A, unknown>,
  url: string,
  init: { method: string; token: string | null; body?: unknown }
): Effect.Effect<A, CloudApiError> =>
  Effect.flatMap(request(url, init), decodeWith(schema));

/** The device flow's answer, as the port names it. */
export const devicePollResult = (
  response: Response
): Effect.Effect<DevicePollResult, CloudApiError> => {
  if (response.status >= 200 && response.status < 300) {
    return Effect.map(
      decodeWith(DeviceTokenResponse)(response),
      (ok): DevicePollResult => ({ kind: "token", token: ok.access_token })
    );
  }
  if (response.status === 400) {
    return Effect.flatMap(
      Effect.try({
        try: () =>
          Schema.decodeUnknownSync(DeviceTokenFailure)(
            JSON.parse(response.body)
          ),
        catch: () => failure(cloudReason(400, response.body), 400),
      }),
      (body): Effect.Effect<DevicePollResult, CloudApiError> => {
        switch (body.error) {
          case "authorization_pending":
            return Effect.succeed({ kind: "pending" });
          case "slow_down":
            return Effect.succeed({ kind: "slow-down" });
          case "expired_token":
            return Effect.succeed({ kind: "expired" });
          case "access_denied":
            return Effect.succeed({ kind: "denied" });
          default:
            return Effect.fail(
              failure(body.error_description ?? body.error, 400)
            );
        }
      }
    );
  }
  return Effect.fail(
    failure(cloudReason(response.status, response.body), response.status)
  );
};

export const makeLiveCloudApi: CloudApiShape = {
  startDevice: (serverUrl) =>
    Effect.map(
      json(DeviceCodeResponse, `${serverUrl}/api/auth/device/code`, {
        method: "POST",
        token: null,
        body: { client_id: DEVICE_CLIENT_ID },
      }),
      (grant): DeviceCodeGrant => ({
        deviceCode: grant.device_code,
        userCode: grant.user_code,
        verificationUri: grant.verification_uri,
        verificationUriComplete:
          grant.verification_uri_complete ??
          `${grant.verification_uri}?user_code=${encodeURIComponent(grant.user_code)}`,
        expiresIn: grant.expires_in,
        interval: grant.interval ?? 5,
      })
    ),
  pollDevice: (serverUrl, deviceCode) =>
    Effect.flatMap(
      request(`${serverUrl}/api/auth/device/token`, {
        method: "POST",
        token: null,
        body: {
          grant_type: DEVICE_GRANT_TYPE,
          device_code: deviceCode,
          client_id: DEVICE_CLIENT_ID,
        },
      }),
      devicePollResult
    ),
  me: (serverUrl, token) =>
    json(CloudViewer, `${serverUrl}/api/me`, { method: "GET", token }),
  repos: (serverUrl, token) =>
    json(Schema.Array(CloudRepo), `${serverUrl}/api/repos`, {
      method: "GET",
      token,
    }),
  listRuns: (serverUrl, token) =>
    json(Schema.Array(CloudRunSummary), `${serverUrl}/api/runs`, {
      method: "GET",
      token,
    }),
  getRun: (serverUrl, token, id) =>
    json(CloudRunSnapshot, `${serverUrl}/api/runs/${encodeURIComponent(id)}`, {
      method: "GET",
      token,
    }),
  createRun: (serverUrl, token, input) =>
    json(CloudRunSnapshot, `${serverUrl}/api/runs`, {
      method: "POST",
      token,
      body: input,
    }),
  sendRunMessage: (serverUrl, token, id, prompt) =>
    json(
      CloudRunSnapshot,
      `${serverUrl}/api/runs/${encodeURIComponent(id)}/messages`,
      { method: "POST", token, body: { prompt } }
    ),
  cancelRun: (serverUrl, token, id) =>
    json(
      CloudRunSnapshot,
      `${serverUrl}/api/runs/${encodeURIComponent(id)}/cancel`,
      { method: "POST", token }
    ),
  setCredential: (serverUrl, token, input) =>
    // The answer is the stored credential, which is of no use here: what
    // matters is that the cloud took it.
    Effect.asVoid(
      request(`${serverUrl}/api/connections/credentials`, {
        method: "PUT",
        token,
        body: input,
      })
    ),
};

export const CloudApiLive: Layer.Layer<CloudApi> = Layer.succeed(CloudApi)(
  CloudApi.of(makeLiveCloudApi)
);
