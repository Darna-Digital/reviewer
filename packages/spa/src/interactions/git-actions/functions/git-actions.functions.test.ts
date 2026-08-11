import { describe, expect, it, vi } from "vitest";
import {
  createGitActionsFunctions,
  summariseCommits,
} from "./git-actions.functions";
import { createGitActionsDependenciesMock } from "./git-actions.functions.mock";

describe("commitChanges", () => {
  it("commits and reports the sha", async () => {
    const deps = createGitActionsDependenciesMock();
    const ok = await createGitActionsFunctions(deps).commitChanges(
      "msg",
      ["a.ts"],
      false
    );
    expect(ok).toBe(true);
    expect(deps.sideEffects.commit).toHaveBeenCalledWith("msg", ["a.ts"]);
    expect(deps.sideEffects.notify).toHaveBeenCalledWith(
      "ok",
      "Committed abc1234"
    );
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
  });

  it("commits then pushes when asked", async () => {
    const deps = createGitActionsDependenciesMock();
    await createGitActionsFunctions(deps).commitChanges("msg", [], true);
    expect(deps.sideEffects.push).toHaveBeenCalled();
    expect(deps.sideEffects.notify).toHaveBeenCalledWith(
      "ok",
      "Committed abc1234 and pushed"
    );
  });

  it("keeps the commit success when the push fails", async () => {
    const deps = createGitActionsDependenciesMock({
      push: vi.fn(async () => {
        throw new Error("no upstream");
      }),
    });
    const ok = await createGitActionsFunctions(deps).commitChanges(
      "msg",
      [],
      true
    );
    expect(ok).toBe(true);
    expect(deps.sideEffects.notify).toHaveBeenCalledWith(
      "err",
      "Committed abc1234, but push failed:\nno upstream"
    );
    expect(deps.sideEffects.refresh).toHaveBeenCalled();
  });

  it("reports a failed commit and does not refresh", async () => {
    const deps = createGitActionsDependenciesMock({
      commit: vi.fn(async () => {
        throw new Error("nothing to commit");
      }),
    });
    const ok = await createGitActionsFunctions(deps).commitChanges(
      "msg",
      [],
      false
    );
    expect(ok).toBe(false);
    expect(deps.sideEffects.notify).toHaveBeenCalledWith(
      "err",
      "nothing to commit"
    );
    expect(deps.sideEffects.refresh).not.toHaveBeenCalled();
  });
});

describe("runOp", () => {
  it("prefers the op output, falls back to the label", async () => {
    const deps = createGitActionsDependenciesMock();
    const fns = createGitActionsFunctions(deps);
    await fns.runOp("Merged x", async () => ({ output: "Fast-forward" }));
    expect(deps.sideEffects.notify).toHaveBeenCalledWith("ok", "Fast-forward");
    await fns.runOp("Fetched", async () => ({ output: "" }));
    expect(deps.sideEffects.notify).toHaveBeenCalledWith("ok", "Fetched");
  });

  it("reports failures", async () => {
    const deps = createGitActionsDependenciesMock();
    await createGitActionsFunctions(deps).runOp("Merged x", async () => {
      throw new Error("conflict");
    });
    expect(deps.sideEffects.notify).toHaveBeenCalledWith("err", "conflict");
  });
});

describe("summariseCommits", () => {
  const ok = (name: string, sha: string) => ({
    repo: { name },
    sha,
    reason: null,
  });
  const bad = (name: string, reason: string) => ({
    repo: { name },
    sha: null,
    reason,
  });

  it("names the sha when a single root committed", () => {
    expect(summariseCommits([ok("backend", "abc1234")])).toEqual({
      kind: "ok",
      text: "Committed abc1234 in backend",
    });
  });

  it("names the roots when several committed", () => {
    expect(
      summariseCommits([ok("backend", "abc1234"), ok("frontend", "def5678")])
    ).toEqual({ kind: "ok", text: "Committed in backend, frontend" });
  });

  it("says what landed and what did not when only some committed", () => {
    const summary = summariseCommits([
      ok("backend", "abc1234"),
      bad("frontend", "nothing to commit"),
    ]);
    expect(summary.kind).toBe("err");
    expect(summary.text).toBe(
      "Committed in backend, but not in:\nfrontend: nothing to commit"
    );
  });

  it("does not claim a commit when every root failed", () => {
    const summary = summariseCommits([bad("backend", "hook rejected")]);
    expect(summary.kind).toBe("err");
    expect(summary.text).toBe("Nothing committed.\nbackend: hook rejected");
  });

  it("says so when the selection matched no root", () => {
    expect(summariseCommits([])).toEqual({
      kind: "err",
      text: "Nothing selected to commit",
    });
  });
});

describe("commitChanges across roots", () => {
  it("reports each root's outcome and refreshes", async () => {
    const notify = vi.fn();
    const refresh = vi.fn();
    const deps = createGitActionsDependenciesMock({
      notify,
      refresh,
      commitAcrossRepos: vi.fn(async () => [
        { repo: { name: "backend" }, sha: "abc1234", reason: null },
        { repo: { name: "frontend" }, sha: null, reason: "nothing to commit" },
      ]),
    });

    const committed = await createGitActionsFunctions(deps).commitChanges(
      "one message",
      ["backend/a.txt", "frontend/b.txt"],
      false
    );

    expect(committed).toBe(false);
    expect(notify).toHaveBeenCalledWith(
      "err",
      "Committed in backend, but not in:\nfrontend: nothing to commit"
    );
    expect(refresh).toHaveBeenCalled();
    // The single-root path must not also run — that would double-commit.
    expect(deps.sideEffects.commit).not.toHaveBeenCalled();
  });
});
