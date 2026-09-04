import { devicePollDelayMs, type NewCloudRun } from "@byconvo/core/cloud";
import type { ChatSettings } from "@/interactions/chats/interfaces/chats.interfaces";
import type {
  CloudApproval,
  CloudDependencies,
  CloudFunctions,
  CloudRunPlace,
} from "../interfaces/cloud.interfaces";

/**
 * The composer's local settings as a cloud run asks for them. The two agree
 * on every word — the cloud's schema was cut from the chat's — so this is a
 * mapping in name only, kept as one place to change should they drift. An
 * empty model is left out rather than sent: the cloud reads "no model" as the
 * CLI's own default, which is what an empty local pick means too.
 */
export const toNewCloudRun = (
  settings: ChatSettings,
  place: CloudRunPlace,
  prompt: string
): NewCloudRun => ({
  repoId: place.repo.id,
  prompt,
  provider: settings.provider,
  ...(settings.model.length > 0 ? { model: settings.model } : {}),
  effort: settings.effort,
  access: settings.access,
  ...(place.baseBranch !== null && place.baseBranch.length > 0
    ? { baseBranch: place.baseBranch }
    : {}),
});

export function createCloudFunctions(d: CloudDependencies): CloudFunctions {
  const awaitApproval: CloudFunctions["awaitApproval"] = async (
    pending,
    signal
  ) => {
    const intervalSeconds = (pending.pending?.intervalMs ?? 5_000) / 1_000;
    const expiresAt =
      pending.pending === null
        ? Number.POSITIVE_INFINITY
        : Date.parse(pending.pending.expiresAt);
    let slowDown = false;
    // Read through a call each time: the flag flips underneath an `await`.
    const aborted = (): boolean => signal?.aborted ?? false;
    for (;;) {
      if (aborted()) return { kind: "cancelled" };
      await d.sideEffects.delay(devicePollDelayMs(intervalSeconds, slowDown));
      if (aborted()) return { kind: "cancelled" };
      // The code has its own lifetime, and the cloud's `expired_token` is the
      // authority on it — but a poll that keeps failing to reach the cloud
      // would otherwise loop for ever, so the clock is checked here too.
      if (d.sideEffects.now() > expiresAt) return { kind: "expired" };
      let next: Awaited<ReturnType<CloudDependencies["sideEffects"]["poll"]>>;
      try {
        next = await d.sideEffects.poll();
        slowDown = false;
      } catch {
        // A poll that did not reach the cloud is retried, more gently.
        slowDown = true;
        continue;
      }
      if (next.status === "connected") {
        return { kind: "connected", connection: next };
      }
      if (next.status === "disconnected") {
        // The service only drops a pending flow when the cloud said the code
        // lapsed or was refused; which of the two is not on the wire, so the
        // clock says which one it most likely was.
        return d.sideEffects.now() >= expiresAt
          ? { kind: "expired" }
          : { kind: "denied" };
      }
    }
  };

  const startCloudRun: CloudFunctions["startCloudRun"] = async (
    settings,
    place,
    text
  ) => {
    const prompt = text.trim();
    if (prompt.length === 0) return null;
    return d.sideEffects.createRun(toNewCloudRun(settings, place, prompt));
  };

  return {
    connect: (serverUrl) => d.sideEffects.connect(serverUrl),
    awaitApproval,
    disconnect: () => d.sideEffects.disconnect(),
    connectAgent: (provider) => d.sideEffects.connectAgent(provider),
    startCloudRun,
    send: async (id, text) => {
      const prompt = text.trim();
      if (prompt.length === 0) return null;
      return d.sideEffects.send(id, prompt);
    },
    cancel: (id) => d.sideEffects.cancel(id),
  };
}

export type { CloudApproval };
