import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CloudRepo } from "@byconvo/core/cloud";
import { fetchClient } from "@/lib/api/client";
import {
  cloudRunQueryOptions,
  cloudStatusOptions,
  useCloudRepos,
  useCloudStatus,
  useRepo,
} from "@/lib/queries";
import { createCloudFunctions } from "../functions/cloud.functions";
import { githubRepoOf } from "../functions/cloud-review.functions";
import type {
  CloudAgentProvider,
  CloudFunctions,
} from "../interfaces/cloud.interfaces";
import { useRunTarget, type RunTarget } from "./run-target.store";

const CLOUD_RUNS_KEY = ["get", "/api/cloud/runs"];

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wires the real cloud API mutations + cache invalidation into the logic. */
export function useCloudActions() {
  const queryClient = useQueryClient();

  const fns: CloudFunctions = useMemo(
    () =>
      createCloudFunctions({
        data: {},
        sideEffects: {
          connect: async (serverUrl) => {
            const { data, error } = await fetchClient.POST(
              "/api/cloud/connect",
              { body: { serverUrl } }
            );
            if (error) return fail(error, "could not reach byconvo cloud");
            return data;
          },
          poll: async () => {
            const { data, error } = await fetchClient.POST("/api/cloud/poll");
            if (error) return fail(error, "could not reach byconvo cloud");
            return data;
          },
          disconnect: async () => {
            const { data, error } = await fetchClient.POST(
              "/api/cloud/disconnect"
            );
            if (error) return fail(error, "failed to disconnect");
            return data;
          },
          connectAgent: async (provider) => {
            const { data, error } = await fetchClient.POST(
              "/api/cloud/agents/{provider}",
              { params: { path: { provider } } }
            );
            if (error) return fail(error, `failed to connect ${provider}`);
            return data;
          },
          createRun: async (input) => {
            const { data, error } = await fetchClient.POST("/api/cloud/runs", {
              body: input,
            });
            if (error) return fail(error, "failed to start the cloud run");
            return data;
          },
          send: async (id, prompt) => {
            const { data, error } = await fetchClient.POST(
              "/api/cloud/runs/{id}/messages",
              { params: { path: { id } }, body: { prompt } }
            );
            if (error) return fail(error, "failed to send");
            return data;
          },
          cancel: async (id) => {
            const { data, error } = await fetchClient.POST(
              "/api/cloud/runs/{id}/cancel",
              { params: { path: { id } } }
            );
            if (error) return fail(error, "failed to cancel the run");
            return data;
          },
          delay: sleep,
          now: () => Date.now(),
        },
      }),
    []
  );

  const invalidateStatus = () =>
    queryClient.invalidateQueries({
      queryKey: cloudStatusOptions().queryKey,
    });
  const invalidateRuns = () =>
    queryClient.invalidateQueries({ queryKey: CLOUD_RUNS_KEY });
  const invalidateRun = (id: string) =>
    queryClient.invalidateQueries({
      queryKey: cloudRunQueryOptions(id).queryKey,
    });

  return {
    connect: async (serverUrl: string) => {
      const pending = await fns.connect(serverUrl);
      queryClient.setQueryData(cloudStatusOptions().queryKey, pending);
      return pending;
    },
    awaitApproval: async (
      ...args: Parameters<CloudFunctions["awaitApproval"]>
    ) => {
      const result = await fns.awaitApproval(...args);
      if (result.kind === "connected") {
        queryClient.setQueryData(
          cloudStatusOptions().queryKey,
          result.connection
        );
      }
      void invalidateStatus();
      return result;
    },
    disconnect: async () => {
      const after = await fns.disconnect();
      queryClient.setQueryData(cloudStatusOptions().queryKey, after);
      void invalidateStatus();
      // Whatever was listed came from the account just disconnected.
      queryClient.removeQueries({ queryKey: CLOUD_RUNS_KEY });
      queryClient.removeQueries({ queryKey: ["get", "/api/cloud/repos"] });
      return after;
    },
    connectAgent: async (provider: CloudAgentProvider) => {
      const connected = await fns.connectAgent(provider);
      // The cloud's own view of what is connected has just changed.
      void invalidateStatus();
      return connected;
    },
    startCloudRun: async (
      ...args: Parameters<CloudFunctions["startCloudRun"]>
    ) => {
      const started = await fns.startCloudRun(...args);
      if (started !== null) {
        queryClient.setQueryData(
          cloudRunQueryOptions(started.run.id).queryKey,
          started
        );
        void invalidateRuns();
      }
      return started;
    },
    send: async (id: string, text: string) => {
      const sent = await fns.send(id, text);
      if (sent !== null) {
        void invalidateRun(id);
        void invalidateRuns();
      }
      return sent;
    },
    cancel: async (id: string) => {
      const cancelled = await fns.cancel(id);
      void invalidateRun(id);
      void invalidateRuns();
      return cancelled;
    },
  };
}

/**
 * Where the next session goes, resolved: the sticky choice, whether the cloud
 * can take it, and which linked repository it would run in.
 *
 * The repository defaults to the one that is this project on GitHub — the
 * linked repository whose full name matches the open repository's remote —
 * and otherwise to the first one linked, so choosing the cloud is one click
 * for the common case and a second only when the project is not the obvious
 * one.
 */
export function useCloudRunTarget(): {
  readonly target: RunTarget;
  readonly connected: boolean;
  readonly repos: ReadonlyArray<CloudRepo>;
  readonly cloudRepo: CloudRepo | null;
} {
  const { target, cloudRepoId } = useRunTarget();
  const status = useCloudStatus();
  const connected = status.data?.status === "connected";
  const repos = useCloudRepos(connected).data ?? [];
  const local = githubRepoOf(useRepo().data);
  const remoteName =
    local === null ? null : `${local.owner}/${local.repo}`.toLowerCase();
  const cloudRepo =
    repos.find((repo) => repo.id === cloudRepoId) ??
    (remoteName === null
      ? undefined
      : repos.find((repo) => repo.fullName.toLowerCase() === remoteName)) ??
    repos[0] ??
    null;
  return { target, connected, repos, cloudRepo };
}
