/**
 * SQLite-backed chat store — chats live in the central database rather than in
 * the repository they were started in, through the shared store the turn
 * runtime also writes through.
 *
 * `list` deliberately spans every project: the sessions surface shows all of
 * them at once and narrows down in the client. Everything that acts on one
 * chat — get, update, remove — finds it by id alone, so a conversation started
 * in another root of the project (or in another project entirely) opens and
 * answers exactly like one started in the selected root.
 */
import * as Effect from "effect/Effect";
import { DEFAULT_CHAT_TITLE } from "@byconvo/core/chats";
import { NotFound } from "@byconvo/core/shared";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import { attempt, inRepo } from "../db/db.service.ts";
import { rememberRepo } from "../db/scope.ts";
import type {
  Chat,
  ChatsRepo,
  CreateChatInput,
  UpdateChatInput,
} from "@byconvo/core/chats";
import {
  findChat,
  insertChat,
  listChatProjects,
  listChatSummaries,
  nextChatId,
  removeChat,
  updateChatSettings,
} from "./store.ts";

export const makeSqliteChatsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const withRepo = inRepo(ctx);

  const requireChat = (id: string): Chat => {
    const chat = findChat(id);
    if (chat === undefined) {
      throw new NotFound({ reason: `chat ${id} not found` });
    }
    return chat;
  };

  const list: ChatsRepo["list"] = (input) =>
    attempt(() => listChatSummaries(input));

  const projects: ChatsRepo["projects"] = attempt(listChatProjects);

  const get: ChatsRepo["get"] = (id) => attempt(() => requireChat(id));

  const create: ChatsRepo["create"] = (input: CreateChatInput) =>
    Effect.flatMap(ctx.project, (projectPath) =>
      withRepo((repoPath) => {
        // A root reached before any project open (the boot seed) would have no
        // project to be grouped under; register it as it is used so the chat is
        // labelled from the moment it exists.
        rememberRepo(repoPath, projectPath ?? repoPath);
        return insertChat({
          id: nextChatId("c"),
          repoPath,
          title:
            input.title.trim().length > 0
              ? input.title.trim()
              : DEFAULT_CHAT_TITLE,
          provider: input.provider,
          model: input.model,
          effort: input.effort,
          access: input.access,
          branch: input.branch,
          createdAt: new Date().toISOString(),
        });
      })
    );

  const update: ChatsRepo["update"] = (id, input: UpdateChatInput) =>
    attempt(() => {
      const existing = requireChat(id);
      const provider = input.provider ?? existing.provider;
      // Switching the chat's agent invalidates the native session — each CLI
      // mints and can only resume its own — so drop the id (the next turn
      // starts the new agent fresh). A provider change without an explicit
      // model also falls back to that CLI's default rather than keeping the
      // previous agent's model id.
      const providerChanged = provider !== existing.provider;
      const updated = updateChatSettings(id, {
        title:
          input.title !== undefined && input.title.trim().length > 0
            ? input.title.trim()
            : existing.title,
        provider,
        model: input.model ?? (providerChanged ? "" : existing.model),
        effort: input.effort ?? existing.effort,
        access: input.access ?? existing.access,
        sessionId: providerChanged ? null : existing.sessionId,
        updatedAt: new Date().toISOString(),
      });
      if (updated === undefined) {
        throw new NotFound({ reason: `chat ${id} not found` });
      }
      return updated;
    });

  const remove: ChatsRepo["remove"] = (id) => attempt(() => removeChat(id));

  return { list, projects, get, create, update, remove } satisfies ChatsRepo;
});
