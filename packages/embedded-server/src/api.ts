import { HttpApi } from "effect/unstable/httpapi";
import { BrowserApi } from "./layers/browser/browser.api.ts";
import { ChatsApi } from "./layers/chats/chats.api.ts";
import { CloudApi } from "./layers/cloud/cloud.api.ts";
import { CommentsApi } from "./layers/comments/comments.api.ts";
import { FormattingApi } from "./layers/formatting/formatting.api.ts";
import { GitMessageApi } from "./layers/git-message/git-message.api.ts";
import { GitHubApi } from "./layers/github/github.api.ts";
import { LanguageApi } from "./layers/language/language.api.ts";
import { LocalDevApi } from "./layers/local-dev/local-dev.api.ts";
import { PlansApi } from "./layers/plans/plans.api.ts";
import { ProjectApi } from "./layers/project/project.api.ts";
import { RepoApi } from "./layers/repo/repo.api.ts";
import { ThreadsApi } from "./layers/threads/threads.api.ts";
import { VisualCommentsApi } from "./layers/visual-comments/visual-comments.api.ts";
import { WorkspaceApi } from "./layers/workspace/workspace.api.ts";

export class Api extends HttpApi.make("byconvo")
  .add(WorkspaceApi)
  .add(RepoApi)
  .add(ProjectApi)
  .add(CommentsApi)
  .add(GitHubApi)
  .add(GitMessageApi)
  .add(ThreadsApi)
  .add(ChatsApi)
  .add(LanguageApi)
  .add(FormattingApi)
  .add(LocalDevApi)
  .add(BrowserApi)
  .add(PlansApi)
  .add(VisualCommentsApi)
  .add(CloudApi)
  .prefix("/api") {}
