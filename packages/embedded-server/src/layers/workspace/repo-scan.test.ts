import { it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { readBranch, scanRepos } from "./repo-scan.ts";
import type { RepoEntry } from "@reviewer/core/workspace";

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "reviewer-scan-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Lay down a repository at `path` on `branch` (a raw sha when null). */
const repo = async (path: string, branch: string | null = "main") => {
  await mkdir(join(root, path, ".git"), { recursive: true });
  await writeFile(
    join(root, path, ".git", "HEAD"),
    branch === null ? "a9c8fb5c0f2b\n" : `ref: refs/heads/${branch}\n`
  );
};

const folder = (path: string) => mkdir(join(root, path), { recursive: true });

const scan = (start = root, depth?: number) =>
  Effect.gen(function* () {
    const found = yield* Ref.make<ReadonlyArray<RepoEntry>>([]);
    yield* scanRepos(
      start,
      (entry) => Ref.update(found, (all) => [...all, entry]),
      depth
    );
    return (yield* Ref.get(found)).map((entry) => ({
      ...entry,
      path: entry.path.slice(root.length + 1),
    }));
  });

describe("scanRepos", () => {
  it.effect("finds the repositories under a folder, with their branches", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await repo("work/backend", "main");
        await repo("work/frontend", "feat/x");
        await folder("work/notes");
      });
      const found = yield* scan();
      expect(
        found.map((entry) => [entry.name, entry.path, entry.branch])
      ).toEqual([
        ["backend", "work/backend", "main"],
        ["frontend", "work/frontend", "feat/x"],
      ]);
      expect(found.every((entry) => entry.lastOpened === null)).toBe(true);
    })
  );
  it.effect("does not step into a repository it found", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await repo("app");
        await repo("app/vendor-lib");
      });
      const found = yield* scan();
      expect(found.map((entry) => entry.path)).toEqual(["app"]);
    })
  );
  it.effect("reports a detached head as no branch", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => repo("app", null));
      const found = yield* scan();
      expect(found[0]?.branch).toBeNull();
    })
  );
  it.effect("skips hidden, dependency, system and media folders", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await repo(".hidden/app");
        await repo("node_modules/dep");
        await repo("Library/Caches/app");
        await repo("Movies/clip");
        await repo("projects/app");
      });
      const found = yield* scan();
      expect(found.map((entry) => entry.path)).toEqual(["projects/app"]);
    })
  );
  it.effect("stops descending past the scan depth", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await repo("a/near");
        await repo("a/b/c/far");
      });
      const found = yield* scan(root, 2);
      expect(found.map((entry) => entry.path)).toEqual(["a/near"]);
    })
  );
  it.effect("never follows a symbolic link", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await repo("real/app");
        await symlink(join(root, "real"), join(root, "alias"));
      });
      const found = yield* scan();
      expect(found.map((entry) => entry.path)).toEqual(["real/app"]);
    })
  );
  it.effect("is empty for a folder that is not there", () =>
    Effect.gen(function* () {
      const found = yield* scan(join(root, "missing"));
      expect(found).toEqual([]);
    })
  );
});

describe("readBranch", () => {
  it.effect("follows a submodule's .git file to the real git directory", () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await mkdir(join(root, "work", ".git", "modules", "vendor"), {
          recursive: true,
        });
        await writeFile(
          join(root, "work", ".git", "modules", "vendor", "HEAD"),
          "ref: refs/heads/release\n"
        );
        await mkdir(join(root, "work", "vendor"), { recursive: true });
        await writeFile(
          join(root, "work", "vendor", ".git"),
          "gitdir: ../.git/modules/vendor\n"
        );
      });
      const branch = yield* readBranch(join(root, "work", "vendor"));
      expect(branch).toBe("release");
    })
  );
  it.effect("is null where there is no repository", () =>
    Effect.gen(function* () {
      expect(yield* readBranch(join(root, "nowhere"))).toBeNull();
    })
  );
});
