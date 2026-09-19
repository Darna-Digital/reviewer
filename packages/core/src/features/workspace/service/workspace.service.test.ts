import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { WorkspaceMemory } from "../layer/workspace.layer.memory.ts";
import { WorkspaceService } from "./workspace.service.ts";

describe("WorkspaceService", () => {
  it.effect("info reflects the seeded project", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.info;
      expect(info.project).toBe("/repo");
      expect(info.current).toBe("/repo");
      expect(info.repos.map((repo) => repo.name)).toEqual(["repo"]);
    }).pipe(Effect.provide(WorkspaceMemory({ project: "/repo" })))
  );
  it.effect("a project folder opens on the first root it holds", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.info;
      expect(info.project).toBe("/work");
      expect(info.current).toBe("/work/backend");
      expect(info.repos.map((repo) => repo.name)).toEqual([
        "backend",
        "frontend",
      ]);
    }).pipe(
      Effect.provide(
        WorkspaceMemory({
          project: "/work",
          repos: ["/work/backend", "/work/frontend"],
        })
      )
    )
  );
  it.effect("selectRepo moves the git views to another root", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.selectRepo("/work/frontend");
      expect(info.current).toBe("/work/frontend");
      // The project itself stays open — that is the point of the split.
      expect(info.project).toBe("/work");
    }).pipe(
      Effect.provide(
        WorkspaceMemory({
          project: "/work",
          repos: ["/work/backend", "/work/frontend"],
        })
      )
    )
  );
  it.effect("selectRepo refuses a root the project does not hold", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const error = yield* Effect.flip(ws.selectRepo("/elsewhere/api"));
      expect(error._tag).toBe("InvalidRepo");
    }).pipe(
      Effect.provide(
        WorkspaceMemory({ project: "/work", repos: ["/work/backend"] })
      )
    )
  );
  it.effect("setCurrent opens another project and prepends to recents", () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceService;
      const info = yield* ws.setCurrent("/another");
      expect(info.project).toBe("/another");
      expect(info.current).toBe("/another");
      expect(info.recents[0]).toBe("/another");
    }).pipe(
      Effect.provide(WorkspaceMemory({ project: "/repo", recents: ["/repo"] }))
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
