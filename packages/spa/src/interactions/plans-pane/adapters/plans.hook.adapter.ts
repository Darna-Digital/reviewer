/**
 * The plans store, wired to the API. Reads and cache invalidation only — the
 * decisions live in `../functions`, which is where they can be tested.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { NewReviewAnnotation } from "@byconvo/core/plans";
import { api, fetchClient } from "@/lib/api/client";

const LIST = "/api/plans";
const ONE = "/api/plans/{id}";

const failed = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string }).reason ?? fallback);
};

/**
 * Analyses are written by an agent working in another tab of the same window,
 * so nothing the pane does causes the result to arrive — and because the window
 * never loses focus, `refetchOnWindowFocus` never fires either. Polling is what
 * closes that gap; the alternative would be a socket for a resource that is a
 * few small JSON files on the local disk.
 *
 * Only while the pane is mounted, which is only while it is open.
 */
const LIST_POLL_MS = 4_000;

/**
 * The open analysis is re-read more slowly: each read re-anchors it against the
 * working tree, so this is the poll that actually touches files.
 */
const PLAN_POLL_MS = 15_000;

export const usePlans = () =>
  api.useQuery("get", LIST, {}, { refetchInterval: LIST_POLL_MS });

/** One plan, together with the verdict on how well it still matches the code. */
export const usePlan = (id: string | null) =>
  api.useQuery(
    "get",
    ONE,
    { params: { path: { id: id ?? "" } } },
    { enabled: id !== null, refetchInterval: PLAN_POLL_MS }
  );

export function usePlanActions() {
  const queryClient = useQueryClient();
  const invalidate = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: ["get", LIST] });
    if (id !== undefined) {
      await queryClient.invalidateQueries({ queryKey: ["get", ONE] });
    }
  };

  return {
    annotate: async (id: string, input: NewReviewAnnotation) => {
      const { data, error } = await fetchClient.POST(
        "/api/plans/{id}/annotations",
        { params: { path: { id } }, body: input }
      );
      if (error) failed(error, "failed to save the note");
      await invalidate(id);
      return data;
    },
    removeAnnotation: async (id: string, annotationId: string) => {
      const { error } = await fetchClient.DELETE(
        "/api/plans/{id}/annotations/{annotationId}",
        { params: { path: { id, annotationId } } }
      );
      if (error) failed(error, "failed to remove the note");
      await invalidate(id);
    },
    /** Freeze the analysis: the review notes go, the findings stay. */
    save: async (id: string) => {
      const { data, error } = await fetchClient.POST("/api/plans/{id}/save", {
        params: { path: { id } },
      });
      if (error) failed(error, "failed to save the analysis");
      await invalidate(id);
      return data;
    },
    remove: async (id: string) => {
      const { error } = await fetchClient.DELETE(ONE, {
        params: { path: { id } },
      });
      if (error) failed(error, "failed to delete the analysis");
      await invalidate();
    },
  };
}
