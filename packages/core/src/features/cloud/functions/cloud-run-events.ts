/**
 * The run's event log, read back as a conversation — the client half of the
 * cloud's own fold.
 *
 * The cloud answers `GET /runs/:id` with a snapshot and then streams every
 * event with a `seq` above the snapshot's `lastSeq`. Folding those through the
 * same rules the server used means the two can never disagree about what the
 * agent said; and being keyed on `seq`, a reconnect that replays an event the
 * snapshot already reflects changes nothing.
 */
import * as Schema from "effect/Schema";
import {
  CloudRunEvent,
  type CloudRunActivity,
  type CloudRunMessage,
  type CloudRunSnapshot,
  type CloudRunStatus,
  type CloudRunTurn,
} from "../schema/cloud.schema.ts";

/** One frame of the stream, checked against the wire shape; throws otherwise. */
export const decodeCloudRunEvent: (input: unknown) => CloudRunEvent =
  Schema.decodeUnknownSync(CloudRunEvent);

export const cloudUserMessageId = (turnId: string) => `${turnId}:user`;
export const cloudAssistantMessageId = (turnId: string) =>
  `${turnId}:assistant`;

const withMessage = (
  messages: ReadonlyArray<CloudRunMessage>,
  message: CloudRunMessage
): ReadonlyArray<CloudRunMessage> =>
  messages.some((m) => m.id === message.id)
    ? messages.map((m) => (m.id === message.id ? message : m))
    : [...messages, message];

const patchTurn = (
  turns: ReadonlyArray<CloudRunTurn>,
  turnId: string,
  patch: Partial<CloudRunTurn>
): ReadonlyArray<CloudRunTurn> =>
  turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t));

/**
 * Fold one event in. Idempotent on `seq`: an event at or before `lastSeq` is
 * one the snapshot already reflects (a reconnect replaying), and is skipped.
 */
export const applyCloudRunEvent = (
  snapshot: CloudRunSnapshot,
  event: CloudRunEvent
): CloudRunSnapshot => {
  if (event.seq <= snapshot.lastSeq) return snapshot;
  const next = { ...snapshot, lastSeq: event.seq };
  const { payload } = event;
  switch (payload.kind) {
    case "turn-queued": {
      const known = snapshot.turns.some((t) => t.id === event.turnId);
      const turn: CloudRunTurn = {
        id: event.turnId,
        runId: event.runId,
        seq: snapshot.turns.length + 1,
        prompt: payload.prompt,
        state: "queued",
        attempts: 0,
        runnerId: null,
        leaseUntil: null,
        cancelRequested: false,
        resultText: null,
        errorMessage: null,
        totalCostUsd: null,
        createdAt: event.at,
        startedAt: null,
        endedAt: null,
      };
      return {
        ...next,
        run: { ...next.run, status: "queued", updatedAt: event.at },
        turns: known ? next.turns : [...next.turns, turn],
        messages: withMessage(next.messages, {
          id: cloudUserMessageId(event.turnId),
          turnId: event.turnId,
          role: "user",
          text: payload.prompt,
          streaming: false,
          createdAt: event.at,
        }),
      };
    }
    case "turn-started":
      return {
        ...next,
        run: { ...next.run, status: "running", updatedAt: event.at },
        turns: patchTurn(next.turns, event.turnId, {
          state: "running",
          startedAt: event.at,
        }),
        messages: withMessage(next.messages, {
          id: cloudAssistantMessageId(event.turnId),
          turnId: event.turnId,
          role: "assistant",
          text: "",
          streaming: true,
          createdAt: event.at,
        }),
      };
    case "status":
      return {
        ...next,
        run: { ...next.run, status: payload.status, updatedAt: event.at },
      };
    case "log":
      return {
        ...next,
        activities: [
          ...next.activities,
          {
            id: `log-${event.seq}`,
            turnId: event.turnId,
            kind: "log",
            tone: "info",
            summary: payload.text,
            detail: null,
            createdAt: event.at,
          },
        ],
      };
    case "delta": {
      const id = cloudAssistantMessageId(event.turnId);
      const existing = next.messages.find((m) => m.id === id);
      const message: CloudRunMessage =
        existing === undefined
          ? {
              id,
              turnId: event.turnId,
              role: "assistant",
              text: payload.text,
              streaming: true,
              createdAt: event.at,
            }
          : { ...existing, text: existing.text + payload.text };
      return { ...next, messages: withMessage(next.messages, message) };
    }
    case "activity":
      return next.activities.some((a) => a.id === payload.activity.id)
        ? next
        : { ...next, activities: [...next.activities, payload.activity] };
    case "turn-completed": {
      const id = cloudAssistantMessageId(event.turnId);
      const existing = next.messages.find((m) => m.id === id);
      const status: CloudRunStatus =
        payload.state === "completed"
          ? "idle"
          : payload.state === "failed"
            ? "failed"
            : payload.state === "cancelled"
              ? "cancelled"
              : next.run.status;
      return {
        ...next,
        run: { ...next.run, status, updatedAt: event.at },
        turns: patchTurn(next.turns, event.turnId, {
          state: payload.state,
          endedAt: event.at,
          resultText: payload.text,
          errorMessage: payload.errorMessage,
          totalCostUsd: payload.totalCostUsd,
        }),
        messages: withMessage(next.messages, {
          id,
          turnId: event.turnId,
          role: "assistant",
          text: payload.text,
          streaming: false,
          createdAt: existing?.createdAt ?? event.at,
        }),
      };
    }
    case "published":
      return {
        ...next,
        run: {
          ...next.run,
          branch: payload.branch,
          headSha: payload.headSha,
          pullRequestUrl: payload.pullRequestUrl ?? next.run.pullRequestUrl,
          updatedAt: event.at,
        },
      };
  }
};

/** Whether something is (or is about to be) working on the run. */
export const isCloudRunActive = (status: CloudRunStatus): boolean =>
  status === "queued" || status === "provisioning" || status === "running";

/** The status as a header shows it. */
export const cloudRunStatusLabel = (status: CloudRunStatus): string => {
  switch (status) {
    case "queued":
      return "Queued";
    case "provisioning":
      return "Provisioning";
    case "running":
      return "Running";
    case "idle":
      return "Idle";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
};

/** The provisioning and tool lines that belong to one turn, in log order. */
export const cloudActivitiesForTurn = (
  activities: ReadonlyArray<CloudRunActivity>,
  turnId: string
): ReadonlyArray<CloudRunActivity> =>
  activities.filter((a) => a.turnId === turnId);
