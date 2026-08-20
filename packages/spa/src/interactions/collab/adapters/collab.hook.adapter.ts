/**
 * The real API behind `collab.functions`, plus the cache invalidation each
 * write implies.
 *
 * Invalidation is by surface rather than by row, for the reason the surfaces
 * exist: a page reads one composed answer, so a write to any part of it makes
 * the whole answer stale. Ticking a to-do off changes the board it is on, the
 * project's own page, the count on the home page and the drawer's task list —
 * four reads, one write, and the alternative is four hand-patched caches that
 * disagree the first time two clients are open.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchClient } from "@/lib/api/client";
import { createCollabFunctions } from "../functions/collab.functions";
import type { CollabFunctions } from "../interfaces/collab.interfaces";

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

/** Every collaboration read, so a write can retire the lot in one call. */
const COLLAB_QUERY_KEYS: ReadonlyArray<ReadonlyArray<string>> = [
  ["get", "/api/collab/home"],
  ["get", "/api/collab/mine"],
  ["get", "/api/collab/notes"],
  ["get", "/api/collab/notes/{id}"],
  ["get", "/api/collab/projects/{id}"],
  ["get", "/api/collab/projects/{id}/board"],
];

export function useCollabActions() {
  const queryClient = useQueryClient();

  const fns: CollabFunctions = useMemo(
    () =>
      createCollabFunctions({
        data: {},
        sideEffects: {
          createProject: async (name, purpose) => {
            const { data, error } = await fetchClient.POST(
              "/api/collab/projects",
              { body: { name, purpose } }
            );
            if (error) return fail(error, "failed to create the project");
            return data;
          },
          createTodo: async (projectId, title, listId) => {
            const { data, error } = await fetchClient.POST(
              "/api/collab/projects/{id}/todos",
              {
                params: { path: { id: projectId } },
                body: { title, listId },
              }
            );
            if (error) return fail(error, "failed to add the to-do");
            return data;
          },
          updateTodo: async (id, patch) => {
            const { data, error } = await fetchClient.PATCH(
              "/api/collab/todos/{id}",
              { params: { path: { id } }, body: patch }
            );
            if (error) return fail(error, "failed to update the to-do");
            return data;
          },
          removeTodo: async (id) => {
            await fetchClient.DELETE("/api/collab/todos/{id}", {
              params: { path: { id } },
            });
          },
          addList: async (projectId, name) => {
            const { data, error } = await fetchClient.POST(
              "/api/collab/projects/{id}/lists",
              { params: { path: { id: projectId } }, body: { name } }
            );
            if (error) return fail(error, "failed to add the list");
            return data;
          },
          createNote: async (title, projectId) => {
            const { data, error } = await fetchClient.POST(
              "/api/collab/notes",
              {
                body: { title, projectId },
              }
            );
            if (error) return fail(error, "failed to create the note");
            return data;
          },
          saveNote: async (id, content) => {
            const { data, error } = await fetchClient.PUT(
              "/api/collab/notes/{id}",
              { params: { path: { id } }, body: { content } }
            );
            if (error) return fail(error, "failed to save the note");
            return data;
          },
          removeNote: async (id) => {
            await fetchClient.DELETE("/api/collab/notes/{id}", {
              params: { path: { id } },
            });
          },
          addBookmark: async (kind, targetId, label) => {
            const { data, error } = await fetchClient.POST(
              "/api/collab/bookmarks",
              { body: { kind, targetId, label } }
            );
            if (error) return fail(error, "failed to add the bookmark");
            return data;
          },
          removeBookmark: async (kind, targetId) => {
            await fetchClient.DELETE(
              "/api/collab/bookmarks/{kind}/{targetId}",
              { params: { path: { kind, targetId } } }
            );
          },
        },
      }),
    []
  );

  return useMemo(() => {
    const refresh = () => {
      for (const queryKey of COLLAB_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    /** Run a write, then retire every read it could have changed. */
    const writing =
      <A extends ReadonlyArray<unknown>, R>(f: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        const result = await f(...args);
        refresh();
        return result;
      };

    return {
      createProject: writing(fns.createProject),
      createTodo: writing(fns.createTodo),
      setDone: writing(fns.setDone),
      moveTodo: writing(fns.moveTodo),
      renameTodo: writing(fns.renameTodo),
      removeTodo: writing(fns.removeTodo),
      addList: writing(fns.addList),
      createNote: writing(fns.createNote),
      saveNote: writing(fns.saveNote),
      removeNote: writing(fns.removeNote),
      toggleBookmark: writing(fns.toggleBookmark),
    };
  }, [fns, queryClient]);
}
