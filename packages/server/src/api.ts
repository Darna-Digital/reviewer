/**
 * The byconvo HTTP API — every feature group mounted under `/api`. This is the
 * single registry the controllers attach their handlers to, mirroring the
 * darna-stack `api.ts`.
 */
import { HttpApi } from "effect/unstable/httpapi"
import { ChatsApi } from "./http/chats.api.ts"
import { CommentsApi } from "./http/comments.api.ts"
import { DocsApi } from "./http/docs.api.ts"
import { GitMessageApi } from "./http/git-message.api.ts"
import { GitHubApi } from "./http/github.api.ts"
import { TasksApi } from "./http/tasks.api.ts"
import { LocalDevApi } from "./http/local-dev.api.ts"
import { RepoApi } from "./http/repo.api.ts"
import { ThreadsApi } from "./http/threads.api.ts"
import { WorkspaceApi } from "./http/workspace.api.ts"

export class Api extends HttpApi.make("byconvo")
  .add(WorkspaceApi)
  .add(RepoApi)
  .add(CommentsApi)
  .add(GitHubApi)
  .add(GitMessageApi)
  .add(ThreadsApi)
  .add(ChatsApi)
  .add(DocsApi)
  .add(TasksApi)
  .add(LocalDevApi)
  .prefix("/api") {}
