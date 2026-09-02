/**
 * A cloud run in the sessions sidebar — the same one-line shape as a local
 * session's row, with the run's status where the turn state would be, and
 * the repository it works in behind the title since it is not this project's.
 */
import { Link } from "@tanstack/react-router";
import {
  cloudRunStatusLabel,
  isCloudRunActive,
  type CloudRunSummary,
} from "@byconvo/core/cloud";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status: CloudRunSummary["status"] }) {
  return (
    <span className="flex size-3.5 shrink-0 items-center justify-center">
      {isCloudRunActive(status) ? (
        <Orb size={14} label={cloudRunStatusLabel(status)} />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            status === "failed" ? "bg-destructive" : "bg-brand-500"
          )}
          aria-label={cloudRunStatusLabel(status)}
        />
      )}
    </span>
  );
}

export function CloudRunRow({
  run,
  active,
}: {
  run: CloudRunSummary;
  active: boolean;
}) {
  return (
    <Link
      to="/modes/agent-session/cloud/$runId"
      params={{ runId: run.id }}
      title={`${run.title} · ${run.repoFullName}`}
      className={cn(
        "group/row flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-elevate focus-visible:bg-elevate",
        active && "bg-elevate-strong"
      )}
    >
      <StatusDot status={run.status} />
      <span className="min-w-0 flex-1 truncate">{run.title}</span>
      <span className="shrink-0 truncate text-xs text-muted-foreground">
        {run.repoFullName.split("/")[1] ?? run.repoFullName}
      </span>
    </Link>
  );
}
