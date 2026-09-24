import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { WorkspaceMemory } from "../layer/workspace.layer.memory.ts";
import { WorkspaceService } from "./workspace.service.ts";

describe("WorkspaceService", () => {
  it.effect("info reflects the seeded repository", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.info;
      expect(info.project).toBe("/repo");
      expect(info.branch).toBe("main");
    }).pipe(Effect.provide(WorkspaceMemory({ project: "/repo" })))
  );
  it.effect("setCurrent opens another repository and prepends to recents", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.setCurrent("/another");
      expect(info.project).toBe("/another");
      expect(info.recents[0]).toBe("/another");
    }).pipe(
      Effect.provide(WorkspaceMemory({ project: "/repo", recents: ["/repo"] }))
    )
  );
  it.effect("repos lists the machine's repositories, an open one stamped", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      yield* ws.setCurrent("/work/frontend");
      const index = yield* ws.repos;
      expect(index.repos.map((repo) => repo.name)).toEqual([
        "backend",
        "frontend",
      ]);
      expect(index.repos[0]?.lastOpened).toBeNull();
      expect(index.repos[1]?.lastOpened).not.toBeNull();
    }).pipe(
      Effect.provide(
        WorkspaceMemory({ repos: ["/work/backend", "/work/frontend"] })
      )
    )
  );
  it.effect("readFile fails with NoRepoSelected when nothing is selected", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const error = yield* Effect.flip(ws.readFile("a.ts"));
      expect(
        (
          error as {
            _tag: string;
          }
        )._tag
      ).toBe("NoRepoSelected");
    }).pipe(Effect.provide(WorkspaceMemory({ project: null })))
  );
  it.effect("writeFile then readFile round-trips contents", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      yield* ws.writeFile("src/x.ts", "hello");
      const file = yield* ws.readFile("src/x.ts");
      expect(file.contents).toBe("hello");
      expect(file.name).toBe("x.ts");
    }).pipe(Effect.provide(WorkspaceMemory({ project: "/repo" })))
  );
});
