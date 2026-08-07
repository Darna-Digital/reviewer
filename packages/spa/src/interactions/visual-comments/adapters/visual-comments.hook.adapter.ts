/**
 * The visual-comment store, wired to the API. There is no business logic worth
 * injecting here the way `comments` does — a visual comment lands in exactly one
 * place — so this is the API surface and the cache invalidation, nothing else.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { NewVisualComment } from "@byconvo/core/visual-comments";
import { api, fetchClient } from "@/lib/api/client";

const KEY = "/api/visual-comments";

const failed = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string }).reason ?? fallback);
};

export const useVisualComments = () => api.useQuery("get", KEY);

export function useVisualCommentActions() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["get", KEY] });

  return {
    add: async (input: NewVisualComment) => {
      const { data, error } = await fetchClient.POST(KEY, { body: input });
      if (error) failed(error, "failed to save the comment");
      await invalidate();
      return data;
    },
    update: async (id: string, body: string) => {
      const { data, error } = await fetchClient.PATCH(
        "/api/visual-comments/{id}",
        { params: { path: { id } }, body: { body } }
      );
      if (error) failed(error, "failed to update the comment");
      await invalidate();
      return data;
    },
    remove: async (id: string) => {
      await fetchClient.DELETE("/api/visual-comments/{id}", {
        params: { path: { id } },
      });
      await invalidate();
    },
  };
}
