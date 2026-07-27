import type { PullRequestInfo } from "@byconvo/core/ports/git-provider"

export interface LogQuery {
  readonly author: string | null
  readonly grep: string | null
  readonly regex: boolean
  readonly caseSensitive: boolean
  readonly after: string | null
  readonly before: string | null
  readonly path: string | null
}

export const emptyLogQuery: LogQuery = {
  author: null,
  grep: null,
  regex: false,
  caseSensitive: false,
  after: null,
  before: null,
  path: null,
}

export type AppMode =
  | "commit"
  | "review"
  | "browse"
  | "chats"
  | "docs"
  | "tasks"
  | "comments"
  | "settings"

export type DiffTarget =
  | { readonly kind: "worktree" }
  | { readonly kind: "range"; readonly base: string; readonly head: string }
  | { readonly kind: "commit"; readonly sha: string; readonly shortSha: string }
  | { readonly kind: "pull"; readonly pull: PullRequestInfo }

export const diffTargetKey = (target: DiffTarget): string => {
  switch (target.kind) {
    case "worktree":
      return "worktree"
    case "range":
      return `${target.base}...${target.head}`
    case "commit":
      return `commit-${target.sha}`
    case "pull":
      return `pr-${target.pull.number}`
  }
}
