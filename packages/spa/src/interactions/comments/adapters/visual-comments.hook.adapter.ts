import { useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/api/client"

export function useVisualCommentsActions() {
  const queryClient = useQueryClient()

  return {
    remove: async (id: string) => {
      const { error } = await fetchClient.DELETE("/api/visual-comments/{id}", {
        params: { path: { id } },
      })
      if (error)
        throw new Error(
          (error as { reason?: string }).reason ?? "failed to resolve"
        )
      void queryClient.invalidateQueries({
        queryKey: ["get", "/api/visual-comments"],
      })
    },
  }
}
