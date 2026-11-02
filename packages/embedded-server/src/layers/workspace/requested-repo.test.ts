import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { CommentsRepository } from "@reviewer/core/comments";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { makeSqliteCommentsRepository } from "../comments/comments.repository.sqlite.ts";
import {
  REPO_HEADER,
  RequestedRepo,
  scopeToRequestedRepo,
} from "./requested-repo.ts";
import { memoryLayer, WorkspaceContext } from "./workspace-context.ts";

const API = "/home/dev/api";
const WEB = "/home/dev/web";
const ELSEWHERE = "/home/dev/elsewhere";

/** As the middleware does for a request carrying `X-Reviewer-Repo`. */
const asRequestFor =
  (repo: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, RequestedRepo, repo);

describe("the repository a request runs against", () => {
  it.effect("is the workspace's first root when the request names none", () =>
    Effect.gen(function* () {
      const ctx = yield* WorkspaceContext;
      expect(yield* ctx.current).toBe(API);
      expect(yield* ctx.requireCurrent).toBe(API);
    }).pipe(Effect.provide(memoryLayer([API, WEB])))
  );

  it.effect("is the root the request names, when it is open", () =>
    Effect.gen(function* () {
      const ctx = yield* WorkspaceContext;
      expect(yield* asRequestFor(WEB)(ctx.requireCurrent)).toBe(WEB);
      expect(yield* asRequestFor(WEB)(ctx.current)).toBe(WEB);
    }).pipe(Effect.provide(memoryLayer([API, WEB])))
  );

  it.effect("is refused, not swapped for another, when it is not open", () =>
    Effect.gen(function* () {
      const ctx = yield* WorkspaceContext;
      const refused = yield* Effect.flip(
        asRequestFor(ELSEWHERE)(ctx.requireCurrent)
      );
      expect(refused._tag).toBe("NoRepoSelected");
      expect(refused.repo).toBe(ELSEWHERE);
      expect(yield* asRequestFor(ELSEWHERE)(ctx.current)).toBeNull();
    }).pipe(Effect.provide(memoryLayer([API, WEB])))
  );

  it.effect("follows the roots as they are reopened", () =>
    Effect.gen(function* () {
      const ctx = yield* WorkspaceContext;
      yield* ctx.openRoots([WEB], "saved-1");
      expect(yield* ctx.roots).toEqual([WEB]);
      expect(yield* ctx.savedId).toBe("saved-1");
      expect(yield* ctx.current).toBe(WEB);
      const refused = yield* Effect.flip(asRequestFor(API)(ctx.requireCurrent));
      expect(refused.repo).toBe(API);
    }).pipe(Effect.provide(memoryLayer([API, WEB])))
  );
});

describe("the X-Reviewer-Repo header", () => {
  const echo = HttpRouter.add(
    "GET",
    "/echo",
    Effect.map(RequestedRepo, (repo) =>
      HttpServerResponse.text(repo ?? "(none)")
    )
  ).pipe(
    Layer.provide(
      HttpRouter.middleware(scopeToRequestedRepo, { global: true })
    ),
    Layer.provide(HttpServer.layerServices)
  );

  const fetchEcho = async (headers: Record<string, string>) => {
    const { handler, dispose } = HttpRouter.toWebHandler(echo);
    try {
      const response = await handler(
        new Request("http://localhost/echo", { headers })
      );
      return await response.text();
    } finally {
      await dispose();
    }
  };

  it("names the root for the request, decoded", async () => {
    const root = "/Users/dev/Rūta's repo";
    expect(await fetchEcho({ [REPO_HEADER]: encodeURIComponent(root) })).toBe(
      root
    );
  });

  it("leaves a request without it naming none", async () => {
    expect(await fetchEcho({})).toBe("(none)");
  });
});

describe("repository-scoped storage under a workspace", () => {
  beforeEach(() => openDatabase(":memory:"));
  afterEach(closeDatabase);

  const comments = Layer.effect(CommentsRepository)(
    makeSqliteCommentsRepository
  ).pipe(Layer.provide(memoryLayer([API, WEB])));

  const input = {
    filePath: "src/a.ts",
    side: "additions" as const,
    lineNumber: 12,
    body: "rename this",
    author: "alice",
    target: "worktree",
  };

  it.effect(
    "keeps each root's rows apart, by the root each request names",
    () =>
      Effect.gen(function* () {
        const repo = yield* CommentsRepository;
        yield* asRequestFor(API)(repo.add(input));
        yield* asRequestFor(WEB)(repo.add({ ...input, body: "web's" }));
        const api = yield* asRequestFor(API)(repo.list);
        const web = yield* asRequestFor(WEB)(repo.list);
        expect(api.map((comment) => comment.body)).toEqual(["rename this"]);
        expect(web.map((comment) => comment.body)).toEqual(["web's"]);
      }).pipe(Effect.provide(comments))
  );
});
