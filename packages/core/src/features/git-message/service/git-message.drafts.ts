/**
 * Where a drafting run's state lives while it runs: one slot per open project,
 * held for the life of the process rather than the life of a request. Drafting
 * takes an agent CLI tens of seconds, and the page that asked for it may be
 * gone — reloaded, navigated away from, or closed — long before the CLI
 * answers, so the answer has to be waiting somewhere when a page comes back.
 *
 * A slot is claimed rather than written, which is what keeps one project from
 * running two CLIs because two windows (or two clicks) asked at once.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { CommitDraft } from "../schema/git-message.schema.ts";

export const IDLE_DRAFT: CommitDraft = {
  status: "idle",
  message: null,
  error: null,
  agent: null,
  paths: [],
};

export interface CommitDraftsShape {
  readonly get: (scope: string) => Effect.Effect<CommitDraft>;
  readonly put: (scope: string, draft: CommitDraft) => Effect.Effect<void>;
  /** The slot, taken for `draft` — or null when a draft is already running. */
  readonly claim: (
    scope: string,
    draft: CommitDraft
  ) => Effect.Effect<CommitDraft | null>;
  readonly clear: (scope: string) => Effect.Effect<void>;
}

export class CommitDrafts extends Context.Service<
  CommitDrafts,
  CommitDraftsShape
>()("CommitDrafts") {}

export const makeCommitDrafts = Effect.sync(() => {
  const byScope = new Map<string, CommitDraft>();
  return CommitDrafts.of({
    get: (scope) => Effect.sync(() => byScope.get(scope) ?? IDLE_DRAFT),
    put: (scope, draft) =>
      Effect.sync(() => {
        byScope.set(scope, draft);
      }),
    claim: (scope, draft) =>
      Effect.sync(() => {
        if (byScope.get(scope)?.status === "running") return null;
        byScope.set(scope, draft);
        return draft;
      }),
    clear: (scope) =>
      Effect.sync(() => {
        byScope.delete(scope);
      }),
  });
});

export const commitDraftsLayer: Layer.Layer<CommitDrafts> =
  Layer.effect(CommitDrafts)(makeCommitDrafts);
