/**
 * useCloudRunStream — the live view of one cloud run. Seeds itself from the
 * run's snapshot (the query cache, else the REST read), then opens the
 * relayed event stream from the snapshot's `lastSeq` and folds every event
 * through the pure reducer. A dropped stream is reopened with capped backoff
 * from the last sequence folded, so nothing is missed and nothing is doubled.
 *
 * `EventSource` reconnects on its own, but to the URL it was given — which
 * would replay from the *original* `after` and rely on the reducer's
 * idempotence to discard the repeats. Managing the reconnect here instead
 * asks only for what is missing.
 */
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  applyCloudRunEvent,
  decodeCloudRunEvent,
  type CloudRunEvent,
  type CloudRunSnapshot,
} from "@byconvo/core/cloud";
import { cloudRunEventsUrl } from "@/lib/api/client";
import { cloudRunQueryOptions } from "@/lib/queries";

export type CloudRunStreamStatus = "connecting" | "live" | "reconnecting";

interface CloudRunStreamState {
  readonly snapshot: CloudRunSnapshot | null;
  readonly error: string | null;
  readonly status: CloudRunStreamStatus;
}

const CLOUD_RUNS_KEY = ["get", "/api/cloud/runs"];

const cachedSnapshot = (
  client: QueryClient,
  id: string | null
): CloudRunSnapshot | null =>
  id === null
    ? null
    : (client.getQueryData<CloudRunSnapshot>(
        cloudRunQueryOptions(id).queryKey
      ) ?? null);

/** Events after which the sidebar's row is out of date. */
const LIST_EVENTS = new Set([
  "turn-queued",
  "turn-started",
  "turn-completed",
  "status",
  "published",
]);

export function useCloudRunStream(runId: string | null): CloudRunStreamState {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<CloudRunSnapshot | null>(() =>
    cachedSnapshot(queryClient, runId)
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CloudRunStreamStatus>("connecting");

  // The REST read the stream starts from when nothing is cached — the same
  // request the route's loader makes, deduplicated.
  const rest = useQuery({
    ...cloudRunQueryOptions(runId ?? ""),
    enabled: runId !== null && snapshot === null,
    retry: false,
  });
  const seed = snapshot ?? rest.data ?? null;
  const restError =
    rest.error === null || rest.error === undefined
      ? null
      : ((rest.error as { reason?: string }).reason ??
        "could not load the run");

  // What the next visit starts from, written on the way out rather than on
  // every delta.
  const latest = useRef<CloudRunSnapshot | null>(seed);

  useEffect(() => {
    if (runId === null || seed === null) return;
    const id = runId;
    let current: CloudRunSnapshot = seed;
    latest.current = seed;
    setSnapshot(seed);
    setError(null);
    setStatus("connecting");

    let source: EventSource | null = null;
    let closed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateList = () => {
      void queryClient.invalidateQueries({ queryKey: CLOUD_RUNS_KEY });
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource(cloudRunEventsUrl(id, current.lastSeq));
      source.onopen = () => {
        attempts = 0;
        setStatus("live");
      };
      source.addEventListener("run", (raw: MessageEvent<string>) => {
        let event: CloudRunEvent;
        try {
          event = decodeCloudRunEvent(JSON.parse(raw.data));
        } catch {
          return;
        }
        current = applyCloudRunEvent(current, event);
        latest.current = current;
        setSnapshot(current);
        if (LIST_EVENTS.has(event.payload.kind)) invalidateList();
      });
      source.onerror = () => {
        if (closed) return;
        source?.close();
        source = null;
        setStatus("reconnecting");
        attempts += 1;
        retryTimer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempts));
      };
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      source?.close();
      if (latest.current !== null) {
        queryClient.setQueryData(
          cloudRunQueryOptions(id).queryKey,
          latest.current
        );
      }
    };
    // `seed` only matters until the stream has something of its own: the
    // effect keys on whether there is one, not on which one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, seed === null, queryClient]);

  return { snapshot: seed, error: error ?? restError, status };
}
