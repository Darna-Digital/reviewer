import { IconFolder } from "@tabler/icons-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createCommitDetailsFunctions } from "@/interactions/commit-details/functions/commit-details.functions";
import { STATUS_COLOR } from "@/lib/git-status";
import { useCommitDetail } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface CommitDetailsPanelProps {
  sha: string | null;
  /** Path currently open from this commit — rendered as the selected row. */
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const formatDateTime = (iso: string): string => {
  if (iso.length === 0) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const indent = (depth: number): React.CSSProperties => ({
  paddingLeft: 8 + depth * 14,
});

export function CommitDetailsPanel({
  sha,
  selectedFile,
  onSelectFile,
}: CommitDetailsPanelProps) {
  const fns = useMemo(
    () => createCommitDetailsFunctions({ data: {}, sideEffects: {} }),
    []
  );
  const detail = useCommitDetail(sha);

  if (sha === null) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
        Select a commit to see its details.
      </div>
    );
  }
  if (detail.isPending) {
    return (
      <div className="grid h-full place-items-center p-4">
        <LoadingCursor label="Loading commit…" />
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="grid h-full place-items-center p-4 text-sm text-destructive">
        Could not load this commit.
      </div>
    );
  }

  const data = detail.data;
  const rows = fns.buildRows(data.files);

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade p-3 text-sm">
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-medium">{data.subject}</div>
          {data.body.length > 0 && (
            <pre className="mt-1 font-sans text-xs whitespace-pre-wrap text-muted-foreground">
              {data.body}
            </pre>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{data.shortSha}</span>
          <span>{data.author}</span>
          {data.authorEmail.length > 0 && (
            <span>&lt;{data.authorEmail}&gt;</span>
          )}
          <span>{formatDateTime(data.authoredAt)}</span>
        </div>

        {data.refs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.refs.map((ref) => (
              <Badge key={ref} variant="secondary" className="font-normal">
                {ref}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {data.files.length} {data.files.length === 1 ? "file" : "files"}
          </div>
          <ul className="text-sm">
            {rows.map((row, i) =>
              row.kind === "folder" ? (
                <li
                  key={`d:${row.label}:${i}`}
                  className="flex items-center gap-1.5 rounded-md py-0.5 pr-2 text-xs font-medium text-muted-foreground"
                  style={indent(row.depth)}
                >
                  <IconFolder className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{row.label}</span>
                  <span className="ml-auto tabular-nums opacity-70">
                    {row.count}
                  </span>
                </li>
              ) : (
                <li key={`f:${row.file.path}`}>
                  <button
                    type="button"
                    aria-current={
                      selectedFile === row.file.path ? "true" : undefined
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-0.5 pr-2 text-left outline-none",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      selectedFile === row.file.path &&
                        "bg-accent font-medium text-accent-foreground hover:bg-accent"
                    )}
                    style={indent(row.depth)}
                    onClick={() => onSelectFile(row.file.path)}
                    title={
                      row.file.oldPath
                        ? `${row.file.oldPath} → ${row.file.path}`
                        : row.file.path
                    }
                  >
                    <span
                      className={cn(
                        "w-3 shrink-0 text-center font-mono text-xs",
                        STATUS_COLOR[row.file.status]
                      )}
                    >
                      {fns.statusLetter(row.file.status)}
                    </span>
                    <span
                      className={cn(
                        "truncate",
                        row.file.status === "deleted" &&
                          "text-muted-foreground line-through"
                      )}
                    >
                      {row.name}
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}
