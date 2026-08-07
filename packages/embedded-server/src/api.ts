import { HttpApi } from "effect/unstable/httpapi";
import { BrowserApi } from "./layers/browser/browser.api.ts";
import { ChatsApi } from "./layers/chats/chats.api.ts";
import { CommentsApi } from "./layers/comments/comments.api.ts";
import { DocsApi } from "./layers/docs/docs.api.ts";
import { GitMessageApi } from "./layers/git-message/git-message.api.ts";
import { GitHubApi } from "./layers/github/github.api.ts";
import { LanguageApi } from "./layers/language/language.api.ts";
import { TasksApi } from "./layers/tasks/tasks.api.ts";
import { LocalDevApi } from "./layers/local-dev/local-dev.api.ts";
import { PlansApi } from "./layers/plans/plans.api.ts";
import { RepoApi } from "./layers/repo/repo.api.ts";
import { ThreadsApi } from "./layers/threads/threads.api.ts";
import { VisualCommentsApi } from "./layers/visual-comments/visual-comments.api.ts";
import { WorkspaceApi } from "./layers/workspace/workspace.api.ts";

export class Api extends HttpApi.make("byconvo")
  .add(WorkspaceApi)
  .add(RepoApi)
  .add(CommentsApi)
  .add(GitHubApi)
  .add(GitMessageApi)
  .add(ThreadsApi)
  .add(ChatsApi)
  .add(DocsApi)
  .add(LanguageApi)
  .add(TasksApi)
  .add(LocalDevApi)
  .add(BrowserApi)
  .add(PlansApi)
  .add(VisualCommentsApi)
  .prefix("/api") {}
