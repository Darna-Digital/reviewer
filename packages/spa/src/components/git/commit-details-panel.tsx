import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FileTypeIcon, TreeChevronIcon } from "@/components/ui/file-type-icon";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createCommitDetailsFunctions } from "@/interactions/commit-details/functions/commit-details.functions";
import type { DetailRow } from "@/interactions/commit-details/interfaces/commit-details.interfaces";
import { STATUS_COLOR } from "@/lib/git-status";
import { useCommitDetail } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface CommitDetailsPanelProps {
  sha: string | null;
  /** Path currently open from this commit — rendered as the selected row. */
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

interface PlacedRow {
  readonly row: DetailRow;
  readonly path: string;
  /** Paths of the folder rows this row sits under, innermost last. */
  readonly ancestors: ReadonlyArray<string>;
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

const placeRows = (
  rows: ReadonlyArray<DetailRow>
): ReadonlyArray<PlacedRow> => {
  const trail: Array<string> = [];
  return rows.map((row) => {
    const ancestors = trail.slice(0, row.depth);
    if (row.kind === "file") return { row, path: row.file.path, ancestors };
    const path =
      row.depth === 0 ? row.label : `${trail[row.depth - 1]}/${row.label}`;
    trail[row.depth] = path;
    return { row, path, ancestors };
  });
};

const indent = (depth: number): React.CSSProperties => ({
  paddingLeft: 4 + depth * 12,
});

const ROW =
  "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

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
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const placed = useMemo(
    () => placeRows(fns.buildRows(detail.data?.files ?? [])),
    [fns, detail.data]
  );

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
  const toggleFolder = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade px-2 py-3">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 px-1.5">
          <h2 className="text-[13px] leading-snug font-medium tracking-[-0.006em] text-balance">
            {data.subject}
          </h2>
          {data.body.length > 0 && (
            <p className="text-xs leading-[1.6] whitespace-pre-wrap text-muted-foreground">
              {data.body}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-5 text-muted-foreground">
            <span className="font-mono tracking-tight text-foreground/70">
              {data.shortSha}
            </span>
            <span aria-hidden>·</span>
            <span
              className="truncate"
              title={
                data.authorEmail.length > 0
                  ? `${data.author} <${data.authorEmail}>`
                  : data.author
              }
            >
              {data.author}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {formatDateTime(data.authoredAt)}
            </span>
          </div>
          {data.refs.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {data.refs.map((ref) => (
                <Badge
                  key={ref}
                  variant="secondary"
                  className="px-1 py-0 text-[10px] font-normal"
                >
                  {ref}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 px-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {data.files.length} {data.files.length === 1 ? "file" : "files"}
          </div>
          <ul>
            {placed
              .filter(
                ({ ancestors }) => !ancestors.some((a) => collapsed.has(a))
              )
              .map(({ row, path }) =>
                row.kind === "folder" ? (
                  <li key={`d:${path}`}>
                    <button
                      type="button"
                      aria-expanded={!collapsed.has(path)}
                      className={cn(
                        ROW,
                        "text-muted-foreground hover:bg-muted"
                      )}
                      style={indent(row.depth)}
                      onClick={() => toggleFolder(path)}
                    >
                      <TreeChevronIcon
                        className={cn(
                          "size-3.5 opacity-60 transition-transform duration-150",
                          collapsed.has(path) && "-rotate-90"
                        )}
                      />
                      <span className="truncate">{row.label}</span>
                      <span className="ml-auto pl-2 text-[11px] tabular-nums opacity-60">
                        {row.count}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={`f:${path}`}>
                    <button
                      type="button"
                      aria-current={
                        selectedFile === row.file.path ? "true" : undefined
                      }
                      className={cn(
                        ROW,
                        "hover:bg-muted",
                        selectedFile === row.file.path &&
                          "bg-accent text-accent-foreground hover:bg-accent"
                      )}
                      style={indent(row.depth)}
                      onClick={() => onSelectFile(row.file.path)}
                      title={
                        row.file.oldPath
                          ? `${row.file.oldPath} → ${row.file.path}`
                          : row.file.path
                      }
                    >
                      <FileTypeIcon
                        path={row.file.path}
                        className="size-3.5 opacity-90"
                      />
                      <span
                        className={cn(
                          "truncate",
                          row.file.status === "deleted" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          "ml-auto pl-2 font-mono text-[11px] font-medium",
                          STATUS_COLOR[row.file.status]
                        )}
                      >
                        {fns.statusLetter(row.file.status)}
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
