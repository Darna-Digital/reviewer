/**
 * One cloud run, followed live — the conversation the run is, and the work
 * around it: the branch it pushes to, the pull request once there is one,
 * and the worker's own narration (clone, branch, push) beside each turn.
 *
 * State comes from the relayed event stream folded through the pure reducer;
 * the follow-up and the cancel go through the REST actions and come back as
 * events. The composer is deliberately plain: a cloud run takes text, and
 * the model and access were settled when it was started.
 */
import {
  IconAlertCircle,
  IconExternalLink,
  IconGitBranch,
  IconGitPullRequest,
  IconPlayerStopFilled,
  IconPlugConnectedX,
  IconSend,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cloudRunStatusLabel,
  isCloudRunActive,
  type CloudRunActivity,
  type CloudRunMessage,
  type CloudRunSnapshot,
  type CloudRunTurn,
} from "@byconvo/core/cloud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { Orb } from "@/components/ui/orb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { ChatMarkdown } from "@/interactions/chats/components/chat-markdown";
import {
  Message,
  MessageBubble,
} from "@/interactions/chats/components/message";
import { WorkLog } from "@/interactions/chats/components/work-log";
import {
  activeWorkStep,
  toWorkSteps,
} from "@/interactions/chats/functions/work-log.functions";
import { useRepo } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useCloudActions } from "../adapters/cloud.hook.adapter";
import { useCloudRunStream } from "../adapters/cloud-run.stream.adapter";
import { reviewDestination } from "../functions/cloud-review.functions";

/** The worker's narration of a turn: the lines it logged while provisioning. */
function ProvisioningLog({
  lines,
}: {
  lines: ReadonlyArray<CloudRunActivity>;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-elevate/60 px-3 py-2 font-mono text-xs text-muted-foreground">
      {lines.map((line) => (
        <div key={line.id} className="break-words whitespace-pre-wrap">
          {line.summary}
        </div>
      ))}
    </div>
  );
}

function TurnError({ message }: { message: string }) {
  return (
    <div className="flex max-w-3xl items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <IconAlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 break-words whitespace-pre-wrap">{message}</span>
    </div>
  );
}

function AssistantMessage({
  message,
  activities,
  turn,
  running,
}: {
  message: CloudRunMessage;
  activities: ReadonlyArray<CloudRunActivity>;
  turn: CloudRunTurn | undefined;
  running: boolean;
}) {
  const streaming = message.streaming && running;
  // The worker's own lines are narration rather than the agent's work, and
  // read as a log; the tool calls fold into steps the way a local turn's do.
  const logs = activities.filter((a) => a.kind === "log");
  const steps = toWorkSteps(
    activities.filter((a) => a.kind !== "log"),
    streaming
  );
  const active = streaming ? activeWorkStep(steps) : undefined;
  return (
    <Message align="start">
      <div className="flex w-full min-w-0 flex-col gap-2">
        <ProvisioningLog lines={logs} />
        {steps.length > 0 && <WorkLog steps={steps} running={streaming} />}
        {message.text.length > 0 ? (
          <ChatMarkdown text={message.text} />
        ) : streaming ? null : message.streaming ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconPlayerStopFilled className="size-3.5" /> Stopped before
            replying.
          </div>
        ) : null}
        {streaming && (
          <ThinkingIndicator
            className="py-1"
            {...(active !== undefined ? { label: active.summary } : {})}
          />
        )}
        {turn !== undefined &&
          turn.state === "failed" &&
          turn.errorMessage !== null && (
            <TurnError message={turn.errorMessage} />
          )}
      </div>
    </Message>
  );
}

function Timeline({ snapshot }: { snapshot: CloudRunSnapshot }) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const running = isCloudRunActive(snapshot.run.status);
  const turns = useMemo(
    () => new Map(snapshot.turns.map((turn) => [turn.id, turn])),
    [snapshot.turns]
  );
  const byTurn = useMemo(() => {
    const grouped = new Map<string, CloudRunActivity[]>();
    for (const activity of snapshot.activities) {
      const list = grouped.get(activity.turnId) ?? [];
      list.push(activity);
      grouped.set(activity.turnId, list);
    }
    return grouped;
  }, [snapshot.activities]);

  // Follow the stream unless the reader has scrolled up to read.
  useEffect(() => {
    const el = viewport.current;
    if (el === null || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [snapshot]);

  // A turn that was queued but has no reply yet still has narration to show.
  const orphanLogs = snapshot.turns.filter(
    (turn) =>
      !snapshot.messages.some(
        (m) => m.turnId === turn.id && m.role === "assistant"
      ) && (byTurn.get(turn.id)?.length ?? 0) > 0
  );

  return (
    <ScrollArea
      viewportRef={viewport}
      onViewportScroll={(event) => {
        const el = event.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1"
      viewportClassName="scroll-fade overscroll-contain"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
        {snapshot.messages.map((message) =>
          message.role === "user" ? (
            <Message key={message.id} align="end">
              <div className="flex max-w-[80%] flex-col items-end gap-2">
                <MessageBubble>{message.text}</MessageBubble>
              </div>
            </Message>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              activities={byTurn.get(message.turnId) ?? []}
              turn={turns.get(message.turnId)}
              running={running}
            />
          )
        )}
        {orphanLogs.map((turn) => (
          <ProvisioningLog key={turn.id} lines={byTurn.get(turn.id) ?? []} />
        ))}
        {running && snapshot.run.status !== "running" && (
          <ThinkingIndicator
            className="py-1"
            label={cloudRunStatusLabel(snapshot.run.status)}
          />
        )}
      </div>
    </ScrollArea>
  );
}

function StatusBadge({
  status,
}: {
  status: CloudRunSnapshot["run"]["status"];
}) {
  const active = isCloudRunActive(status);
  return (
    <Badge
      variant={
        status === "failed" ? "destructive" : active ? "secondary" : "outline"
      }
      className="gap-1.5"
    >
      {active && <Orb size={12} label={cloudRunStatusLabel(status)} />}
      {cloudRunStatusLabel(status)}
    </Badge>
  );
}

export function CloudRunView({ runId }: { runId: string }) {
  const { snapshot, error, status } = useCloudRunStream(runId);
  const actions = useCloudActions();
  const repo = useRepo();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (error !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Run unavailable</div>
        <div className="text-muted-foreground">{error}</div>
      </div>
    );
  }
  if (snapshot === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingCursor label="Loading run…" />
      </div>
    );
  }

  const { run } = snapshot;
  const active = isCloudRunActive(run.status);
  // Read the pull request here when it is this repository's, rather than
  // handing the reader off to a browser tab.
  const review = reviewDestination(run, repo.data);
  // The cloud refuses a prompt only while provisioning; anywhere else one is
  // queued behind whatever is running.
  const canSend = run.status !== "provisioning" && !sending;

  const send = async () => {
    const text = draft;
    if (text.trim().length === 0) return;
    setSending(true);
    try {
      const sent = await actions.send(run.id, text);
      if (sent !== null) setDraft("");
    } catch (sendError) {
      toast.error(
        sendError instanceof Error ? sendError.message : "failed to send"
      );
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    try {
      await actions.cancel(run.id);
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : "failed to cancel the run"
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium" title={run.title}>
          {run.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {run.repoFullName}
        </span>
        <span className="flex max-w-56 items-center gap-1 truncate text-xs text-muted-foreground">
          <IconGitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{run.branch}</span>
        </span>
        <StatusBadge status={run.status} />
        {review.kind === "byconvo" && (
          <Link
            to="/modes/code/review/pull/$number"
            params={{ number: String(review.number) }}
            className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
          >
            <IconGitPullRequest className="size-3.5" />
            Review #{review.number}
          </Link>
        )}
        {review.kind === "elsewhere" && (
          <a
            href={review.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
            title={`Opened against ${review.repoFullName}, which is not the repository byconvo has open`}
          >
            Pull request
            <IconExternalLink className="size-3.5" />
          </a>
        )}
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void cancel()}
          >
            <IconPlayerStopFilled className="size-3.5" />
            Cancel
          </Button>
        )}
      </header>
      {status === "reconnecting" && (
        <div className="flex items-center justify-center gap-1.5 border-b border-warning/30 bg-warning/10 py-1 text-xs text-warning-foreground">
          <IconPlugConnectedX className="size-3.5" />
          Connection lost — reconnecting…
        </div>
      )}
      {snapshot.messages.length === 0 && snapshot.activities.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Waiting for the cloud to pick the run up…
        </div>
      ) : (
        <Timeline snapshot={snapshot} />
      )}
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col px-2 pb-4">
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border bg-background p-2",
            !canSend && "opacity-70"
          )}
        >
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={!canSend}
            placeholder={
              run.status === "provisioning"
                ? "The cloud is setting the run up…"
                : "Ask for follow-up changes…"
            }
            className="min-h-12 border-0 bg-transparent"
            aria-label="Follow-up prompt"
          />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {run.provider}
              {run.model.length > 0 ? ` · ${run.model}` : ""} · {run.access}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!canSend || draft.trim().length === 0}
              onClick={() => void send()}
            >
              <IconSend className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
