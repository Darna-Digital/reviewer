import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { CloudApiError, MEMORY_VIEWER } from "../../../ports/cloud-api.ts";
import { CloudNotConnected } from "../errors.ts";
import { CloudMemory } from "../layer/cloud.layer.memory.ts";
import type { StoredCloudConnection } from "../repository/cloud.repository.ts";
import { CloudService, DEFAULT_CLOUD_SERVER_URL } from "./cloud.service.ts";

const connected: StoredCloudConnection = {
  serverUrl: "https://cloud.test",
  token: "token-stored",
  pendingDeviceCode: null,
  pending: null,
  user: MEMORY_VIEWER,
  connectedAt: "2026-01-01T00:00:00.000Z",
};

describe("CloudService", () => {
  it.effect("starts disconnected, pointed at the default server", () => {
    const { layer } = CloudMemory();
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      const status = yield* cloud.status;
      expect(status).toEqual({
        serverUrl: DEFAULT_CLOUD_SERVER_URL,
        status: "disconnected",
        user: null,
        connectedAt: null,
        pending: null,
      });
    }).pipe(Effect.provide(layer));
  });

  it.effect(
    "connect starts the device flow and shows the code, not the secret",
    () => {
      const { layer, calls } = CloudMemory();
      return Effect.gen(function* () {
        const cloud = yield* CloudService;
        const pending = yield* cloud.connect("cloud.test/");
        expect(calls.startDevice).toEqual([
          { serverUrl: "https://cloud.test" },
        ]);
        expect(pending.status).toBe("pending");
        expect(pending.serverUrl).toBe("https://cloud.test");
        expect(pending.pending?.userCode).toBe("ABCD-EFGH");
        expect(pending.pending?.intervalMs).toBe(5_000);
        expect(JSON.stringify(pending)).not.toContain("device-code-1");
      }).pipe(Effect.provide(layer));
    }
  );

  it.effect("poll leaves a pending flow alone until the cloud answers", () => {
    const { layer, calls } = CloudMemory(null, {
      polls: [
        { kind: "pending" },
        { kind: "slow-down" },
        { kind: "token", token: "token-1" },
      ],
    });
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      yield* cloud.connect("cloud.test");
      expect((yield* cloud.poll).status).toBe("pending");
      expect((yield* cloud.poll).status).toBe("pending");
      const done = yield* cloud.poll;
      expect(done.status).toBe("connected");
      expect(done.user).toEqual(MEMORY_VIEWER);
      expect(done.connectedAt).not.toBeNull();
      expect(done.pending).toBeNull();
      expect(calls.pollDevice).toHaveLength(3);
      expect(calls.pollDevice[0]).toEqual({
        serverUrl: "https://cloud.test",
        deviceCode: "device-code-1",
      });
      expect(calls.me).toEqual([
        { serverUrl: "https://cloud.test", token: "token-1" },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("a denied code goes back to disconnected", () => {
    const { layer } = CloudMemory(null, { polls: [{ kind: "denied" }] });
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      yield* cloud.connect("cloud.test");
      const after = yield* cloud.poll;
      expect(after.status).toBe("disconnected");
      expect(after.pending).toBeNull();
      expect(after.serverUrl).toBe("https://cloud.test");
    }).pipe(Effect.provide(layer));
  });

  it.effect("an expired code goes back to disconnected", () => {
    const { layer } = CloudMemory(null, { polls: [{ kind: "expired" }] });
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      yield* cloud.connect("cloud.test");
      expect((yield* cloud.poll).status).toBe("disconnected");
    }).pipe(Effect.provide(layer));
  });

  it.effect("poll with nothing pending is a read, not a call", () => {
    const { layer, calls } = CloudMemory(connected);
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      expect((yield* cloud.poll).status).toBe("connected");
      expect(calls.pollDevice).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });

  it.effect("disconnect forgets the token but keeps the server", () => {
    const { layer } = CloudMemory(connected);
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      const after = yield* cloud.disconnect;
      expect(after.status).toBe("disconnected");
      expect(after.user).toBeNull();
      expect(after.serverUrl).toBe("https://cloud.test");
      const error = yield* Effect.flip(cloud.credentials);
      expect(error).toBeInstanceOf(CloudNotConnected);
    }).pipe(Effect.provide(layer));
  });

  it.effect("delegates to the cloud with the stored token", () => {
    const { layer, calls } = CloudMemory(connected, {
      repos: [
        {
          id: "repo-1",
          hostId: "1",
          owner: "acme",
          name: "api",
          fullName: "acme/api",
          defaultBranch: "main",
          private: false,
          cloneUrl: "https://github.com/acme/api.git",
          htmlUrl: "https://github.com/acme/api",
          linkedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      const repos = yield* cloud.repos;
      expect(repos.map((r) => r.fullName)).toEqual(["acme/api"]);
      yield* cloud.runs;
      const created = yield* cloud.createRun({
        repoId: "repo-1",
        prompt: "fix the build",
      });
      yield* cloud.run(created.run.id);
      yield* cloud.send(created.run.id, "and the tests");
      const cancelled = yield* cloud.cancel(created.run.id);
      expect(cancelled.run.status).toBe("cancelled");

      const auth = { serverUrl: "https://cloud.test", token: "token-stored" };
      expect(calls.repos).toEqual([auth]);
      expect(calls.listRuns).toEqual([auth]);
      expect(calls.createRun).toEqual([
        { ...auth, input: { repoId: "repo-1", prompt: "fix the build" } },
      ]);
      expect(calls.getRun).toEqual([{ ...auth, id: created.run.id }]);
      expect(calls.sendRunMessage).toEqual([
        { ...auth, id: created.run.id, prompt: "and the tests" },
      ]);
      expect(calls.cancelRun).toEqual([{ ...auth, id: created.run.id }]);
      expect(yield* cloud.credentials).toEqual(auth);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses cloud calls while disconnected", () => {
    const { layer, calls } = CloudMemory();
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      const error = yield* Effect.flip(cloud.repos);
      expect(error).toBeInstanceOf(CloudNotConnected);
      expect(calls.repos).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });

  it.effect("passes the cloud's own failure through", () => {
    const { layer } = CloudMemory(connected, {
      failure: new CloudApiError({ reason: "token revoked", status: 401 }),
    });
    return Effect.gen(function* () {
      const cloud = yield* CloudService;
      const error = yield* Effect.flip(cloud.runs);
      expect(error).toBeInstanceOf(CloudApiError);
      expect(error.message).toBe("token revoked");
    }).pipe(Effect.provide(layer));
  });

  describe("connectAgent", () => {
    it.effect("signs in here and carries the credential to the cloud", () => {
      // The vendors redirect their login to localhost, so it can only happen
      // on this machine — the point of doing it here rather than in a sandbox.
      const cloud = CloudMemory(connected, {}, { signedIn: '{"tokens":{}}' });
      return Effect.gen(function* () {
        const service = yield* CloudService;
        const result = yield* service.connectAgent("codex");

        expect(result).toEqual({ kind: "signed-in" });
        expect(cloud.authCalls.signIn).toEqual(["codex"]);
        expect(cloud.calls.setCredential).toEqual([
          {
            serverUrl: "https://cloud.test",
            token: "token-stored",
            kind: "codex-auth",
            secret: '{"tokens":{}}',
          },
        ]);
      }).pipe(Effect.provide(cloud.layer));
    });

    it.effect("uses an existing login rather than opening a browser", () => {
      const cloud = CloudMemory(
        connected,
        {},
        { existing: '{"tokens":{"a":1}}' }
      );
      return Effect.gen(function* () {
        const service = yield* CloudService;
        const result = yield* service.connectAgent("codex");

        expect(result).toEqual({ kind: "reused" });
        // Somebody who already ran `codex login` is not sent to a browser.
        expect(cloud.authCalls.signIn).toEqual([]);
        expect(cloud.calls.setCredential[0]?.secret).toBe('{"tokens":{"a":1}}');
      }).pipe(Effect.provide(cloud.layer));
    });

    it.effect("will not sign in when the cloud is not connected", () => {
      const cloud = CloudMemory(null, {}, { signedIn: '{"tokens":{}}' });
      return Effect.gen(function* () {
        const service = yield* CloudService;
        const result = yield* Effect.exit(service.connectAgent("codex"));

        expect(result._tag).toBe("Failure");
        // And no browser was opened for a login that could not be delivered.
        expect(cloud.authCalls.signIn).toEqual([]);
        expect(cloud.calls.setCredential).toEqual([]);
      }).pipe(Effect.provide(cloud.layer));
    });
  });
});
