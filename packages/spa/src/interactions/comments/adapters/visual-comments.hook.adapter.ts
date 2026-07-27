import { useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/api/client"
import type { VisualComment } from "@byconvo/core/visual-comments"

export function useVisualCommentsActions() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: ["get", "/api/visual-comments"],
    })

  return {
    update: async (id: string, body: string): Promise<VisualComment> => {
      const { data, error } = await fetchClient.PATCH(
        "/api/visual-comments/{id}",
        {
          params: { path: { id } },
          body: { body },
        }
      )
      if (error)
        throw new Error(
          (error as { reason?: string }).reason ?? "failed to update"
        )
      invalidate()
      return data
    },
    remove: async (id: string) => {
      const { error } = await fetchClient.DELETE("/api/visual-comments/{id}", {
        params: { path: { id } },
      })
      if (error)
        throw new Error(
          (error as { reason?: string }).reason ?? "failed to resolve"
        )
      invalidate()
    },
  }
}
