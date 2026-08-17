import * as Layer from "effect/Layer";
import {
  GitMessageChanges,
  makeRepoChanges,
} from "../service/git-message.changes.ts";
import { commitDraftsLayer } from "../service/git-message.drafts.ts";
import {
  GitMessageService,
  makeGitMessageService,
} from "../service/git-message.service.ts";

export const GitMessageMemory = () =>
  Layer.effect(GitMessageService)(makeGitMessageService).pipe(
    Layer.provide(Layer.effect(GitMessageChanges)(makeRepoChanges)),
    Layer.provide(commitDraftsLayer)
  );
