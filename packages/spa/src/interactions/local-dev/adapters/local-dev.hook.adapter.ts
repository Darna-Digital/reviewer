import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchClient } from "@/lib/api/client";
import { createLocalDevFunctions } from "../functions/local-dev.functions";
import type { LocalDevFunctions } from "../interfaces/local-dev.interfaces";

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

/** Wires the real Local Dev API mutations + cache invalidation into the logic. */
export function useLocalDevActions() {
  const queryClient = useQueryClient();

  const fns: LocalDevFunctions = useMemo(
    () =>
      createLocalDevFunctions({
        data: {},
        sideEffects: {
          create: async (input) => {
            const { data, error } = await fetchClient.POST(
              "/api/local-dev/commands",
              { body: input }
            );
            if (error) return fail(error, "failed to create command");
            return data;
          },
          update: async (id, input) => {
            const { data, error } = await fetchClient.PATCH(
              "/api/local-dev/commands/{id}",
              { params: { path: { id } }, body: input }
            );
            if (error) return fail(error, "failed to update command");
            return data;
          },
          remove: async (id) => {
            await fetchClient.DELETE("/api/local-dev/commands/{id}", {
              params: { path: { id } },
            });
          },
          start: async (id) => {
            const { error } = await fetchClient.POST(
              "/api/local-dev/commands/{id}/start",
              { params: { path: { id } } }
            );
            if (error) fail(error, "failed to start command");
          },
          stop: async (id) => {
            await fetchClient.POST("/api/local-dev/commands/{id}/stop", {
              params: { path: { id } },
            });
          },
          startAll: async (repoPath) => {
            const { error } = await fetchClient.POST(
              "/api/local-dev/start-all",
              { body: repoPath === undefined ? {} : { repoPath } }
            );
            if (error) fail(error, "failed to start commands");
          },
          stopAll: async (repoPath) => {
            await fetchClient.POST("/api/local-dev/stop-all", {
              body: repoPath === undefined ? {} : { repoPath },
            });
          },
        },
      }),
    []
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["get", "/api/local-dev/commands"],
    });
  };

  return {
    create: async (name: string, command: string, repoPath: string) => {
      const created = await fns.create(name, command, repoPath);
      invalidate();
      return created;
    },
    update: async (
      id: string,
      name: string,
      command: string,
      repoPath: string
    ) => {
      const updated = await fns.update(id, name, command, repoPath);
      invalidate();
      return updated;
    },
    remove: async (id: string) => {
      await fns.remove(id);
      invalidate();
    },
    start: async (id: string) => {
      await fns.start(id);
      invalidate();
    },
    stop: async (id: string) => {
      await fns.stop(id);
      invalidate();
    },
    startAll: async (repoPath?: string) => {
      await fns.startAll(repoPath);
      invalidate();
    },
    stopAll: async (repoPath?: string) => {
      await fns.stopAll(repoPath);
      invalidate();
    },
  };
}
