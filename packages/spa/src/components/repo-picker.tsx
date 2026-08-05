import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconGitBranch,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, fetchClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  handleSearchKeyDown,
  handleSearchRowKeyDown,
} from "@/components/ui/search-keydown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ROW_TOOLTIP_PLACEMENT,
  TruncatedText,
  truncatedTooltipClass,
  useClippedText,
} from "@/components/ui/truncated-text";
import { displayPath, pathName } from "@/lib/display-path";
import { isDesktop, openDesktopDirectory } from "@/lib/desktop";
import { repoAvatar } from "@/lib/repo-avatar";
import { cn } from "@/lib/utils";
import type { RepoInfo } from "@byconvo/core/repo";
import type { WorkspaceInfo } from "@byconvo/core/workspace";

interface RepoPickerProps {
  repo: RepoInfo | null;
  workspace: WorkspaceInfo | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called after a repository is opened, instead of the default jump to the
   * commit view. The workspace pages pass this so switching repo keeps you on
   * the current page (now scoped to the newly-opened repo).
   */
  onChosen?: () => void;
  /** Which way the popover opens — "top" for a bar pinned to the bottom. */
  side?: "top" | "bottom";
}

function Avatar({
  name,
  className = "size-5 text-[10px]",
}: {
  name: string;
  className?: string;
}) {
  const a = repoAvatar(name);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-sm font-semibold text-white ${className}`}
      style={{ backgroundColor: a.color }}
    >
      {a.initials}
    </span>
  );
}

/** Matches the branch dropdown's menu items, on buttons the menu doesn't own. */
const rowClass =
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-elevate hover:text-foreground focus:bg-elevate focus:text-foreground";

const sectionLabelClass = "px-2 py-1 text-xs text-muted-foreground";

const emptyClass = "px-2 py-6 text-center text-sm text-muted-foreground";

/**
 * A folder row: name over its path. Anywhere on the row is the tooltip's
 * trigger, so a clipped path can be read without aiming at the path itself.
 */
function PathRow({
  icon,
  label,
  path,
  emphasized,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  path: string;
  emphasized?: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  const { ref, clipped, measure } = useClippedText<HTMLSpanElement>(path);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-search-row
            className={cn(rowClass, "items-start")}
            onClick={onClick}
            onMouseEnter={measure}
          />
        }
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate", emphasized && "font-medium")}>
            {label}
          </div>
          <div className="text-xs font-normal text-muted-foreground">
            <span ref={ref} className="block truncate">
              {path}
            </span>
          </div>
        </div>
        {trailing}
      </TooltipTrigger>
      {clipped && (
        <TooltipContent
          {...ROW_TOOLTIP_PLACEMENT}
          className={truncatedTooltipClass}
        >
          {path}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

/** The repo chip in the top bar; opening it reveals a recents + folder browser
 * dropdown (a Popover, so the folder browser's controls don't auto-close it). */
export function RepoPicker({
  repo,
  workspace,
  open,
  onOpenChange,
  onChosen,
  side,
}: RepoPickerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [path, setPath] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const browse = api.useQuery(
    "get",
    "/api/fs/browse",
    { params: { query: path === null ? {} : { path } } },
    { enabled: open && browsing }
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setBrowsing(false);
      setPath(null);
      return;
    }
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const choose = async (target: string) => {
    const { data, error } = await fetchClient.POST("/api/workspace", {
      body: { path: target },
    });
    if (error) {
      toast.error(
        (error as { message?: string; reason?: string }).message ??
          (error as { reason?: string }).reason ??
          "could not open repository"
      );
      return;
    }
    if (data !== undefined) {
      queryClient.setQueryData(["get", "/api/workspace"], data);
    }
    await queryClient.invalidateQueries();
    onOpenChange(false);
    // Workspace pages stay put (now scoped to the new repo); the git-review
    // shell defaults to jumping into the commit view.
    if (onChosen !== undefined) onChosen();
    else void navigate({ to: "/modes/code/commit", search: {} });
  };

  const chooseDirectory = async () => {
    const selected = await openDesktopDirectory();
    if (selected !== null) {
      await choose(selected);
    }
  };

  const home = workspace?.home;
  const recents = workspace?.recents ?? [];
  const filteredRecents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return recents;
    return recents.filter((recent) => recent.toLowerCase().includes(q));
  }, [query, recents]);

  const data = browse.data;
  const entries = data?.entries ?? [];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-56 gap-2 rounded-full px-3.5 py-1.5"
          />
        }
      >
        {repo !== null && <Avatar name={repo.name} />}
        {repo === null && (
          <IconFolder className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{repo?.name ?? "Choose project"}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={side ?? "bottom"}
        onKeyDown={handleSearchRowKeyDown}
        className="w-80 gap-0 overflow-hidden p-0"
      >
        {!browsing && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b px-2.5 py-2">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                data-search-input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search projects"
                aria-label="Search projects"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <ScrollArea className="max-h-96">
              <div className="p-1">
                {filteredRecents.length > 0 && (
                  <div className={sectionLabelClass}>Recent</div>
                )}
                {filteredRecents.map((recent) => {
                  const isCurrent = recent === workspace?.current;
                  return (
                    <PathRow
                      key={recent}
                      icon={
                        <IconFolder className="size-4 h-lh shrink-0 text-muted-foreground" />
                      }
                      label={pathName(recent)}
                      path={displayPath(recent, home)}
                      emphasized={isCurrent}
                      trailing={
                        isCurrent && (
                          <IconCheck className="size-4 h-lh shrink-0 text-muted-foreground" />
                        )
                      }
                      onClick={() => void choose(recent)}
                    />
                  );
                })}
                {recents.length > 0 && filteredRecents.length === 0 && (
                  <div className={emptyClass}>No projects match “{query}”</div>
                )}
                {recents.length === 0 && (
                  <div className={emptyClass}>No recent projects</div>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t p-1">
              {isDesktop && (
                <button
                  type="button"
                  data-search-row
                  className={rowClass}
                  onClick={() => void chooseDirectory()}
                >
                  <IconFolderOpen className="size-4 shrink-0 text-muted-foreground" />
                  <span>Use an existing folder</span>
                </button>
              )}
              <button
                type="button"
                data-search-row
                className={rowClass}
                onClick={() => {
                  setBrowsing(true);
                  setPath(null);
                }}
              >
                <IconFolder className="size-4 shrink-0 text-muted-foreground" />
                <span>Browse folders</span>
              </button>
            </div>
          </>
        )}

        {browsing && (
          <>
            <div className="flex shrink-0 items-center gap-1 border-b px-1.5 py-1.5">
              <button
                type="button"
                data-search-row
                className={cn(rowClass, "w-auto shrink-0 px-1.5")}
                onClick={() => {
                  setBrowsing(false);
                  setPath(null);
                }}
                aria-label="Back to projects"
              >
                <IconArrowLeft className="size-4 text-muted-foreground" />
              </button>
              <div className="flex min-w-0 flex-1 px-1 text-xs text-muted-foreground">
                <TruncatedText
                  text={
                    data === undefined
                      ? "Browse…"
                      : displayPath(data.path, home)
                  }
                />
              </div>
            </div>

            <ScrollArea className="max-h-96">
              <div className="p-1">
                {browse.isPending && (
                  <div className="px-2 py-3">
                    <LoadingCursor label="Loading folders…" />
                  </div>
                )}
                {browse.error && (
                  <div className="px-2 py-3 text-sm text-destructive">
                    Could not read this folder.
                  </div>
                )}
                {data?.parent != null && (
                  <button
                    type="button"
                    data-search-row
                    className={rowClass}
                    onClick={() => setPath(data.parent)}
                  >
                    <IconArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                    <span>..</span>
                  </button>
                )}
                {!browse.isPending &&
                  !browse.error &&
                  data !== undefined &&
                  data.parent == null &&
                  entries.length === 0 && (
                    <div className={emptyClass}>No folders found.</div>
                  )}
                {entries.map((entry) => (
                  <div
                    key={entry.path}
                    className={cn(rowClass, "pr-1 focus-within:bg-elevate")}
                  >
                    <button
                      type="button"
                      data-search-row
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-hidden"
                      onClick={() => setPath(entry.path)}
                    >
                      {entry.isGitRepo ? (
                        <IconGitBranch className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <IconFolder className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{entry.name}</span>
                    </button>
                    {entry.isGitRepo && (
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground outline-hidden hover:bg-elevate-strong hover:text-foreground focus:bg-elevate-strong focus:text-foreground"
                        onClick={() => void choose(entry.path)}
                      >
                        Open
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {data !== undefined && data.isGitRepo && (
              <div className="shrink-0 border-t p-1">
                <PathRow
                  icon={
                    <IconGitBranch className="size-4 h-lh shrink-0 text-muted-foreground" />
                  }
                  label="Open this repository"
                  path={displayPath(data.path, home)}
                  emphasized
                  onClick={() => void choose(data.path)}
                />
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
