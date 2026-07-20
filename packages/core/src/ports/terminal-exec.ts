import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { TerminalError } from "../errors.ts"

export interface TerminalResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}
export interface TerminalExecShape {
  readonly run: (
    command: string
  ) => Effect.Effect<TerminalResult, TerminalError>
}
export class TerminalExec extends Context.Service<
  TerminalExec,
  TerminalExecShape
>()("TerminalExec") {}
export const memoryLayer = (
  result: (command: string) => TerminalResult = (command) => ({
    stdout: command,
    stderr: "",
    exitCode: 0,
  })
): Layer.Layer<TerminalExec> =>
  Layer.succeed(TerminalExec)(
    TerminalExec.of({ run: (c) => Effect.succeed(result(c)) })
  )
