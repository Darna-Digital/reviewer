import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { describe, expect } from "vitest"
import { GitExec } from "../../../ports/git-exec.ts"
import {
  memoryLayer as terminalMemory,
  type TerminalResult,
} from "../../../ports/terminal-exec.ts"
import { GitMessageMemory } from "../layer/git-message.layer.memory.ts"
import { GitMessageService } from "./git-message.service.ts"

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
  )
const agentReturning = (result?: Partial<TerminalResult>) =>
  terminalMemory((command) => ({
    stdout: result?.stdout ?? command,
    stderr: result?.stderr ?? "",
    exitCode: result?.exitCode ?? 0,
  }))
describe("GitMessageService", () => {
  it.effect("generate drafts a message from the diff", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService
      const message = yield* svc.generate([], "claude")
      expect(message).toBe("Add the thing\n\n- did the thing")
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("diff --git a b"),
          agentReturning({ stdout: "Add the thing\n\n- did the thing" })
        )
      )
    )
  )
  it.effect("generate cleans wrapping quotes from the model output", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService
      const message = yield* svc.generate([], "claude")
      expect(message).toBe("trim it")
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff"),
          agentReturning({ stdout: "'trim it'" })
        )
      )
    )
  )
  it.effect("generate prepends the branch issue slug to the prompt", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService
      const echoed = yield* svc.generate([], "claude")
      expect(echoed).toContain("DAR-144")
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff", "feature/DAR-144-add-thing"),
          agentReturning()
        )
      )
    )
  )
  it.effect("generate fails when there are no changes", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService
      const result = yield* Effect.exit(svc.generate([], "claude"))
      expect(result._tag).toBe("Failure")
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(Layer.mergeAll(gitWith(""), agentReturning()))
    )
  )
  it.effect("generate fails when the agent CLI exits non-zero", () =>
    Effect.gen(function* () {
      const svc = yield* GitMessageService
      const result = yield* Effect.exit(svc.generate([], "opencode"))
      expect(result._tag).toBe("Failure")
    }).pipe(
      Effect.provide(GitMessageMemory()),
      Effect.provide(
        Layer.mergeAll(
          gitWith("some diff"),
          agentReturning({ exitCode: 1, stderr: "command not found" })
        )
      )
    )
  )
})
