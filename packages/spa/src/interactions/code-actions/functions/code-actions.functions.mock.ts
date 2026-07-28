import type {
  CodeActionCapabilities,
  CodeActionsDependencies,
} from "../interfaces/code-actions.interfaces"

export const allCapabilities: CodeActionCapabilities = {
  comment: true,
  edit: true,
}

export function mockCodeActionsDependencies(
  capabilities: Partial<CodeActionCapabilities> = {}
) {
  const calls = { comment: [] as Array<number>, edit: [] as Array<number> }

  const deps: CodeActionsDependencies = {
    data: { capabilities: { ...allCapabilities, ...capabilities } },
    sideEffects: {
      comment: (line) => calls.comment.push(line),
      edit: (line) => calls.edit.push(line),
    },
  }

  return { deps, calls }
}
