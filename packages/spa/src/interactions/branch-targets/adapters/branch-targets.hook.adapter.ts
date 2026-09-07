/**
 * Aiming a branch: saying which branch its work is meant to land on.
 *
 * Git has no such notion, so reviewer records it — once, when the answer is
 * known — and every later read of that branch's diff has something to be read
 * against without asking again.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";

const failureText = (error: unknown): string => {
  const detail = error as {
    message?: string;
    reason?: string;
    stderr?: string;
  };
  const stderr = detail.stderr?.trim();
  return (
    detail.message ??
    detail.reason ??
    (stderr !== undefined && stderr.length > 0 ? stderr : undefined) ??
    "request failed"
  );
};

export function useBranchTargetActions() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      /** Aim a branch's work somewhere, so its diff has something to read against. */
      aim: async (branch: string, target: string) => {
        const { error } = await fetchClient.POST("/api/branch-targets", {
          body: { branch, target },
        });
        if (error !== undefined) {
          toast.error(failureText(error));
          return false;
        }
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/branch-targets"],
        });
        return true;
      },
    }),
    [queryClient]
  );
}
