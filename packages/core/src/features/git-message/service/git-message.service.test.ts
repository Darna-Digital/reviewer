import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";
import { GitExec } from "../../../ports/git-exec.ts";
import {
  memoryLayer as terminalMemory,
  TerminalExec,
  type TerminalResult,
} from "../../../ports/terminal-exec.ts";
import { GitMessageMemory } from "../layer/git-message.layer.memory.ts";
import { GitMessageService } from "./git-message.service.ts";
import type { CommitDraft } from "../schema/git-message.schema.ts";

const gitWith = (diff: string, branch = "main") =>
  Layer.effect(GitExec)(
    Effect.succeed(
      GitExec.of({
        run: (...args) =>
          Effect.succeed(args[0] === "rev-parse" ? branch : diff),
        runVerbose: () => Effect.succeed(""),
        runTolerant: (...args) =>
          Effect.succeed(args[0] === "rev-parse" ? branch : diff),
        lines: () => Effect.succeed([]),
      })
    )
  );
const agentReturning = (result?: Partial<TerminalResult>) =>
  terminalMemory((command) => ({
    stdout: result?.stdout ?? command,
    stderr: result?.stderr ?? "",
    exitCode: result?.exitCode ?? 0,
  }));
/** A CLI that never answers — a draft started against it stays running. */
const hangingAgent = Layer.succeed(TerminalExec)(
  TerminalExec.of({ run: () => Effect.never })
);

/** The draft once the detached run has settled, however many turns that takes. */
const settledDraft = (scope: string) =>
  Effect.gen(function* () {
    const svc = yield* GitMessageService;
    for (let attempt = 0; attempt < 100; attempt++) {
      const draft = yield* svc.draft(scope);
      if (draft.status !== "running") return draft;
      yield* Effect.yieldNow;
    }
    return yield* svc.draft(scope);
  });

describe("GitMessageService", () => {
  it.effect("generate drafts a message from the diff", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const message = yield* svc.generate([], "claude");
      expect(message).toBe("Add the thing\n\n- did the thing");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("diff --git a b"),
          agentReturning({ stdout: "Add the thing\n\n- did the thing" })
        )
      )
    )
  );
  it.effect("generate cleans wrapping quotes from the model output", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const message = yield* svc.generate([], "claude");
      expect(message).toBe("trim it");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff"),
          agentReturning({ stdout: "'trim it'" })
        )
      )
    )
  );
  it.effect("generate prepends the branch issue slug to the prompt", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const echoed = yield* svc.generate([], "claude");
      expect(echoed).toContain("DAR-144");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff", "feature/DAR-144-add-thing"),
          agentReturning()
        )
      )
    )
  );
  it.effect("generate fails when there are no changes", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const result = yield* Effect.exit(svc.generate([], "claude"));
      expect(result._tag).toBe("Failure");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(Layer.mergeAll(gitWith(""), agentReturning()))
    )
  );
  it.effect("start answers before the CLI does, then holds the message", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const started = yield* svc.start("/project", [], "claude");
      expect(started.status).toBe("running");
      expect(started.message).toBeNull();
      const settled = yield* settledDraft("/project");
      expect(settled.status).toBe("ready");
      expect(settled.message).toBe("Add the thing");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("diff --git a b"),
          agentReturning({ stdout: "Add the thing" })
        )
      )
    )
  );
  it.effect("a draft survives being asked for from somewhere else", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      yield* svc.start("/project", [], "claude");
      yield* settledDraft("/project");
      const draft = yield* svc.draft("/project");
      expect(draft.message).toBe("Add the thing");
      expect(yield* svc.clear("/project")).toMatchObject({ status: "idle" });
      expect(yield* svc.draft("/project")).toMatchObject({
        status: "idle",
        message: null,
      });
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("diff --git a b"),
          agentReturning({ stdout: "Add the thing" })
        )
      )
    )
  );
  it.effect("start while a draft runs keeps the one run", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const first = yield* svc.start("/project", ["a.ts"], "claude");
      const second = yield* svc.start("/project", ["b.ts"], "codex");
      expect(first.status).toBe("running");
      expect(second).toMatchObject({ status: "running", agent: "claude" });
      expect(second.paths).toEqual(["a.ts"]);
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(Layer.mergeAll(gitWith("diff --git a b"), hangingAgent))
    )
  );
  it.effect("a draft that fails is kept as the error, not lost", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      yield* svc.start("/project", [], "opencode");
      const settled: CommitDraft = yield* settledDraft("/project");
      expect(settled.status).toBe("error");
      expect(settled.error).toContain("command not found");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff"),
          agentReturning({ exitCode: 1, stderr: "command not found" })
        )
      )
    )
  );
  it.effect("generate fails when the agent CLI exits non-zero", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService;
      const result = yield* Effect.exit(svc.generate([], "opencode"));
      expect(result._tag).toBe("Failure");
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff"),
          agentReturning({ exitCode: 1, stderr: "command not found" })
        )
      )
    )
  );
});
