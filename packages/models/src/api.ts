import type {
  Chat,
  ChatModelCatalog,
  ChatSummary,
  NewChat,
  SendChatMessage,
  UpdateChat,
} from "./chats.ts"
import type { NewComment, ReviewComment } from "./comments.ts"
import type { Doc, DocSummary, NewDoc, UpdateDoc } from "./docs.ts"
import type { GenerateBody, GeneratedMessage } from "./git-message.ts"
import type { PrComment, PrReply, PullRequestInfo } from "./github.ts"
import type {
  DevCommand,
  DevCommandView,
  NewDevCommand,
  UpdateDevCommand,
} from "./local-dev.ts"
import type {
  BranchInfo,
  Checkout,
  CommandOutput,
  CommitBody,
  CommitDetail,
  CommitInfo,
  CommitResult,
  ConflictBlobs,
  ConflictParam,
  CreateBranch,
  DeleteBranch,
  DiffQuery,
  Discard,
  DiscardHunk,
  FilesPayload,
  LogQueryParams,
  Merge,
  MergeState,
  Rebase,
  RemoteBranchInfo,
  RenameBranch,
  RepoInfo,
  RepoStatus,
  ResolveConflict,
} from "./repo.ts"
import type {
  Board,
  Card,
  CommentResolution,
  NewCard,
  NewColumn,
  NewComment as NewTaskComment,
  SetPrefix,
  UpdateCard,
  UpdateColumn,
} from "./tasks.ts"
import type {
  NewThread,
  RenameThread,
  RunCommand,
  Thread,
  ThreadEntry,
  ThreadSummary,
} from "./threads.ts"
import type {
  BrowsePayload,
  BrowseQuery,
  FileContent,
  Ok,
  PathQuery,
  RenameFile,
  SetWorkspace,
  WorkspaceInfo,
  WriteFile,
} from "./workspace.ts"

interface NoParams {
  query?: never
  header?: never
  path?: never
  cookie?: never
}

interface Query<Q> {
  query: Q
  header?: never
  path?: never
  cookie?: never
}

interface OptionalQuery<Q> {
  query?: Q
  header?: never
  path?: never
  cookie?: never
}

interface PathParams<P> {
  query?: never
  header?: never
  path: P
  cookie?: never
}

type Wire<T> =
  T extends ReadonlyArray<infer E>
    ? Array<Wire<E>>
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T

interface JsonOk<S> {
  200: {
    headers: { [name: string]: unknown }
    content: { "application/json": S }
  }
}

interface Op<Params, Success> {
  parameters: Params
  responses: JsonOk<Wire<Success>>
}

interface OpWithBody<Params, Body, Success> {
  parameters: Params
  requestBody: { content: { "application/json": Wire<Body> } }
  responses: JsonOk<Wire<Success>>
}

type Id = { id: string }

export interface ApiPaths {
  "/api/workspace": {
    get: Op<NoParams, WorkspaceInfo>
    post: OpWithBody<NoParams, SetWorkspace, WorkspaceInfo>
  }
  "/api/fs/browse": {
    get: Op<OptionalQuery<BrowseQuery>, BrowsePayload>
  }
  "/api/file": {
    get: Op<Query<PathQuery>, FileContent>
    put: OpWithBody<NoParams, WriteFile, Ok>
    delete: Op<Query<PathQuery>, Ok>
  }
  "/api/file/rename": {
    post: OpWithBody<NoParams, RenameFile, Ok>
  }
  "/api/repo": {
    get: Op<NoParams, RepoInfo>
  }
  "/api/files": {
    get: Op<NoParams, FilesPayload>
  }
  "/api/status": {
    get: Op<NoParams, RepoStatus>
  }
  "/api/branches": {
    get: Op<NoParams, ReadonlyArray<BranchInfo>>
  }
  "/api/remote-branches": {
    get: Op<NoParams, ReadonlyArray<RemoteBranchInfo>>
  }
  "/api/log": {
    get: Op<OptionalQuery<LogQueryParams>, ReadonlyArray<CommitInfo>>
  }
  "/api/commit/{sha}": {
    get: Op<PathParams<{ sha: string }>, CommitDetail>
  }
  "/api/diff": {
    get: Op<OptionalQuery<DiffQuery>, string>
  }
  "/api/checkout": {
    post: OpWithBody<NoParams, Checkout, Ok>
  }
  "/api/commit": {
    post: OpWithBody<NoParams, CommitBody, CommitResult>
  }
  "/api/discard": {
    post: OpWithBody<NoParams, Discard, Ok>
  }
  "/api/discard-hunk": {
    post: OpWithBody<NoParams, DiscardHunk, Ok>
  }
  "/api/push": {
    post: Op<NoParams, CommandOutput>
  }
  "/api/pull": {
    post: Op<NoParams, CommandOutput>
  }
  "/api/fetch": {
    post: Op<NoParams, CommandOutput>
  }
  "/api/merge": {
    post: OpWithBody<NoParams, Merge, CommandOutput>
  }
  "/api/rebase": {
    post: OpWithBody<NoParams, Rebase, CommandOutput>
  }
  "/api/merge-state": {
    get: Op<NoParams, MergeState>
  }
  "/api/conflict": {
    get: Op<Query<ConflictParam>, ConflictBlobs>
  }
  "/api/conflicts/resolve": {
    post: OpWithBody<NoParams, ResolveConflict, Ok>
  }
  "/api/merge/abort": {
    post: Op<NoParams, CommandOutput>
  }
  "/api/merge/continue": {
    post: Op<NoParams, CommandOutput>
  }
  "/api/branch": {
    post: OpWithBody<NoParams, CreateBranch, Ok>
  }
  "/api/branch/rename": {
    post: OpWithBody<NoParams, RenameBranch, Ok>
  }
  "/api/branch/delete": {
    post: OpWithBody<NoParams, DeleteBranch, Ok>
  }
  "/api/comments": {
    get: Op<NoParams, ReadonlyArray<ReviewComment>>
    post: OpWithBody<NoParams, NewComment, ReviewComment>
  }
  "/api/comments/{id}": {
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/github/pulls": {
    get: Op<NoParams, ReadonlyArray<PullRequestInfo>>
  }
  "/api/github/pulls/{number}/diff": {
    get: Op<PathParams<{ number: string }>, string>
  }
  "/api/github/pulls/{number}/comments": {
    get: Op<PathParams<{ number: string }>, ReadonlyArray<ReviewComment>>
    post: OpWithBody<PathParams<{ number: string }>, PrComment, ReviewComment>
  }
  "/api/github/pulls/{number}/comments/{commentId}/replies": {
    post: OpWithBody<
      PathParams<{ number: string; commentId: string }>,
      PrReply,
      ReviewComment
    >
  }
  "/api/git-message/generate": {
    post: OpWithBody<NoParams, GenerateBody, GeneratedMessage>
  }
  "/api/threads": {
    get: Op<NoParams, ReadonlyArray<ThreadSummary>>
    post: OpWithBody<NoParams, NewThread, Thread>
  }
  "/api/threads/{id}": {
    get: Op<PathParams<Id>, Thread>
    patch: OpWithBody<PathParams<Id>, RenameThread, Thread>
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/threads/{id}/run": {
    post: OpWithBody<PathParams<Id>, RunCommand, ThreadEntry>
  }
  "/api/chats": {
    get: Op<NoParams, ReadonlyArray<ChatSummary>>
    post: OpWithBody<NoParams, NewChat, Chat>
  }
  "/api/chats/models": {
    get: Op<NoParams, ChatModelCatalog>
  }
  "/api/chats/{id}": {
    get: Op<PathParams<Id>, Chat>
    patch: OpWithBody<PathParams<Id>, UpdateChat, Chat>
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/chats/{id}/messages": {
    post: OpWithBody<PathParams<Id>, SendChatMessage, Chat>
  }
  "/api/chats/{id}/stop": {
    post: Op<PathParams<Id>, Ok>
  }
  "/api/docs": {
    get: Op<NoParams, ReadonlyArray<DocSummary>>
    post: OpWithBody<NoParams, NewDoc, Doc>
  }
  "/api/docs/{id}": {
    get: Op<PathParams<Id>, Doc>
    put: OpWithBody<PathParams<Id>, UpdateDoc, Doc>
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/tasks/board": {
    get: Op<NoParams, Board>
  }
  "/api/tasks": {
    get: Op<NoParams, ReadonlyArray<Card>>
  }
  "/api/tasks/resolve/{ref}": {
    get: Op<PathParams<{ ref: string }>, Card>
  }
  "/api/tasks/prefix": {
    put: OpWithBody<NoParams, SetPrefix, Board>
  }
  "/api/tasks/cards": {
    post: OpWithBody<NoParams, NewCard, Card>
  }
  "/api/tasks/cards/{id}": {
    patch: OpWithBody<PathParams<Id>, UpdateCard, Card>
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/tasks/columns": {
    post: OpWithBody<NoParams, NewColumn, Board>
  }
  "/api/tasks/columns/{id}": {
    patch: OpWithBody<PathParams<Id>, UpdateColumn, Board>
    delete: Op<PathParams<Id>, Board>
  }
  "/api/tasks/cards/{id}/comments": {
    post: OpWithBody<PathParams<Id>, NewTaskComment, Card>
  }
  "/api/tasks/cards/{id}/comments/{commentId}": {
    delete: Op<PathParams<{ id: string; commentId: string }>, Card>
  }
  "/api/tasks/comments/{commentId}": {
    get: Op<PathParams<{ commentId: string }>, CommentResolution>
  }
  "/api/local-dev/commands": {
    get: Op<NoParams, ReadonlyArray<DevCommandView>>
    post: OpWithBody<NoParams, NewDevCommand, DevCommand>
  }
  "/api/local-dev/commands/{id}": {
    get: Op<PathParams<Id>, DevCommand>
    patch: OpWithBody<PathParams<Id>, UpdateDevCommand, DevCommand>
    delete: Op<PathParams<Id>, Ok>
  }
  "/api/local-dev/commands/{id}/start": {
    post: Op<PathParams<Id>, DevCommandView>
  }
  "/api/local-dev/commands/{id}/stop": {
    post: Op<PathParams<Id>, Ok>
  }
  "/api/local-dev/start-all": {
    post: Op<NoParams, ReadonlyArray<DevCommandView>>
  }
  "/api/local-dev/stop-all": {
    post: Op<NoParams, Ok>
  }
}
