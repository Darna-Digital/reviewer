import type { PullRequestInfo } from "@byconvo/core/github"

export type {
  BrowseEntry,
  BrowsePayload,
  FileContent,
  RepoEntry,
  WorkspaceInfo,
} from "@byconvo/core/workspace"
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
} from "@byconvo/core/repo"
export type { CommentSide, ReviewComment } from "@byconvo/core/comments"
export type { PullRequestInfo } from "@byconvo/core/github"
export type {
  AgentKind,
  Thread,
  ThreadEntry,
  ThreadSummary,
} from "@byconvo/core/threads"
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
} from "@byconvo/core/chats"
export type { Doc, DocSummary } from "@byconvo/core/docs"
export type {
  Board as TasksBoard,
  Card as TasksCard,
  TasksColumn,
} from "@byconvo/core/tasks"
export type {
  DevCommand,
  DevCommandStatus,
  DevCommandView,
} from "@byconvo/core/local-dev"
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
  | "threads"
  | "docs"
  | "tasks"
  | "local-dev"
export type DiffTarget =
  | {
      readonly kind: "worktree"
    }
  | {
      readonly kind: "range"
      readonly base: string
      readonly head: string
    }
  | {
      readonly kind: "commit"
      readonly sha: string
      readonly shortSha: string
    }
  | {
      readonly kind: "pull"
      readonly pull: PullRequestInfo
    }
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
