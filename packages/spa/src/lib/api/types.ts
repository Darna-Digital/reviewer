import type { PullRequestInfo } from "@byconvo/models/github"

export type {
  BrowseEntry,
  BrowsePayload,
  FileContent,
  RepoEntry,
  WorkspaceInfo,
} from "@byconvo/models/workspace"
export type {
  BranchInfo,
  CommitDetail,
  CommitFileChange,
  CommitInfo,
  ConflictBlobs,
  ConflictKind,
  ConflictedFile,
  FilesPayload,
  GitFileStatus,
  GitStatusEntry,
  MergeOperation,
  MergeState,
  RemoteBranchInfo,
  RepoInfo,
  RepoStatus,
} from "@byconvo/models/repo"
export type { CommentSide, ReviewComment } from "@byconvo/models/comments"
export type { PullRequestInfo } from "@byconvo/models/github"
export type {
  AgentKind,
  Thread,
  ThreadEntry,
  ThreadSummary,
} from "@byconvo/models/threads"
export type {
  Chat,
  ChatAccess,
  ChatActivity,
  ChatAttachment,
  ChatEffort,
  ChatImageUpload,
  ChatMessage,
  ChatMode,
  ChatModel,
  ChatModelCatalog,
  ChatModelProvider,
  ChatProviderKind,
  ChatSummary,
  ChatTurn,
  ChatTurnState,
  ChatWireEvent,
} from "@byconvo/models/chats"
export type { Doc, DocSummary } from "@byconvo/models/docs"
export type {
  Board as TasksBoard,
  Card as TasksCard,
  TasksColumn,
} from "@byconvo/models/tasks"
export type {
  DevCommand,
  DevCommandStatus,
  DevCommandView,
} from "@byconvo/models/local-dev"

/** Log-filter state shared by the toolbar and the route search params. */
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

/**
 * The top-level IDE modes (also the top-level route segments). The first three
 * are the git-review modes (rendered by AppShell); threads/docs/tasks are the
 * workspace modes (rendered by WorkspaceShell).
 */
export type AppMode =
  | "commit"
  | "review"
  | "browse"
  | "chats"
  | "threads"
  | "docs"
  | "tasks"
  | "local-dev"

/** What the center pane is currently diffing. */
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
