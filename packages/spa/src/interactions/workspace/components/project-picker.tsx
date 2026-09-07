/**
 * The project chip in the top bar: recents, and a folder browser for opening
 * something new. A project is a folder — a git repository, or a parent holding
 * several (`backend`, `frontend`) — so the browser offers both, marking each
 * folder with what it holds rather than only letting repositories through.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconGitBranch,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  clippedText,
  truncatedTooltipClass,
  useClipGate,
} from "@/components/ui/truncated-text";
import { api } from "@/lib/api/client";
import { displayPath, pathName } from "@/lib/display-path";
import { isDesktop, openDesktopDirectory } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";
import { useWorkspaceActions } from "../adapters/workspace.hook.adapter";
import { folderHint, folderName, isOpenable } from "@reviewer/core/workspace";
import type { WorkspaceInfo } from "@reviewer/core/workspace";

interface ProjectPickerProps {
  workspace: WorkspaceInfo | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called after a project is opened, instead of the default jump to the
   * browse view. The workspace pages pass this so switching project keeps you
   * on the current page (now scoped to the newly-opened project).
   */
  onChosen?: () => void;
  /** Which way the popover opens — "top" for a bar pinned to the bottom. */
  side?: "top" | "bottom";
  /**
   * Set on the window bar, where the chip is sized to the tab strip it leads
   * rather than to the header row it used to sit in: the strip's type, the
   * strip's inset, and a mark the size of a tab's icon.
   */
  onWindowBar?: boolean;
  /**
   * A `TooltipContent` for the chip, so a row that labels its controls can
   * label this one the same way. It is held back while the dropdown is up,
   * which is what the chip has to say by then.
   */
  tooltip?: React.ReactNode;
}

/** Matches the branch dropdown's menu items, on buttons the menu doesn't own. */
const rowClass =
  "flex w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-hidden select-none hover:bg-elevate hover:text-foreground focus:bg-elevate focus:text-foreground";

const sectionLabelClass = "px-2.5 pt-2 pb-1 text-xs text-muted-foreground";

const emptyClass = "px-2.5 py-6 text-center text-sm text-muted-foreground";

/**
 * Rows are two lines tall, so their hover fills sit close enough to read as one
 * block; the gap matches the padding the list already keeps at its edges.
 */
const listClass = "flex flex-col gap-1 p-1";

/**
 * The list scrolls at a few rows rather than running the popover down the
 * window — the search box above it is the way through a long list, and the
 * "browse folders" row below it has to stay in sight to be found.
 */
const listHeight = "max-h-[min(15rem,45vh)]";

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
  const { ref, full, open, gate } = useClipGate<HTMLSpanElement>(clippedText);

  return (
    <Tooltip open={open} onOpenChange={gate}>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-search-row
            className={cn(rowClass, "items-start")}
            onClick={onClick}
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
      {full !== null && (
        <TooltipContent
          {...ROW_TOOLTIP_PLACEMENT}
          className={truncatedTooltipClass}
        >
          {full}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function ProjectPicker({
  workspace,
  open,
  onOpenChange,
  onChosen,
  side,
  onWindowBar,
  tooltip,
}: ProjectPickerProps) {
  const navigate = useNavigate();
  const actions = useWorkspaceActions();
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
    const opened = await actions.openProject(target);
    if (opened === null) return;
    onOpenChange(false);
    // Workspace pages stay put (now scoped to the new project); the git-review
    // shell lands in the arriving project's tree, the same as moving between
    // roots does, rather than in a review of whatever is uncommitted there.
    if (onChosen !== undefined) onChosen();
    else void navigate({ to: "/modes/code/browse", search: {} });
  };

  const chooseDirectory = async () => {
    const selected = await openDesktopDirectory();
    if (selected !== null) {
      await choose(selected);
    }
  };

  const home = workspace?.home;
  const recents = useMemo(() => workspace?.recents ?? [], [workspace]);
  const filteredRecents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return recents;
    return recents.filter((recent) => recent.toLowerCase().includes(q));
  }, [query, recents]);

  const data = browse.data;
  const entries = data?.entries ?? [];
  const projectName =
    workspace?.project == null ? null : folderName(workspace.project);

  const chip = (
    <Button
      variant="ghost"
      size="chip"
      className={cn(
        "max-w-56 gap-2 px-2 py-1.5",
        onWindowBar && "max-w-44 gap-1.5 py-0 pr-1.5 pl-2 text-[0.8125rem]"
      )}
    />
  );

  const chipContent = (
    <>
      {projectName !== null && (
        <ProjectAvatar
          name={projectName}
          className={cn(onWindowBar && "size-4")}
        />
      )}
      {projectName === null && (
        <IconFolder className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{projectName ?? "Choose project"}</span>
      <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
    </>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {tooltip === undefined ? (
        <PopoverTrigger render={chip}>{chipContent}</PopoverTrigger>
      ) : (
        <Tooltip disabled={open}>
          <TooltipTrigger render={<PopoverTrigger render={chip} />}>
            {chipContent}
          </TooltipTrigger>
          {tooltip}
        </Tooltip>
      )}
      <PopoverContent
        align="start"
        side={side ?? "bottom"}
        onKeyDown={handleSearchRowKeyDown}
        className="w-80 gap-0 overflow-hidden p-0"
      >
        {!browsing && (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
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

            <ScrollArea className={listHeight}>
              <div className={listClass}>
                {filteredRecents.length > 0 && (
                  <div className={sectionLabelClass}>Recent</div>
                )}
                {filteredRecents.map((recent) => {
                  const isCurrent = recent === workspace?.project;
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

            <div className={cn("shrink-0 border-t", listClass)}>
              {isDesktop && (
                <button
                  type="button"
                  data-search-row
                  className={rowClass}
                  onClick={() => void chooseDirectory()}
                >
                  <IconFolder className="size-4 shrink-0 text-muted-foreground" />
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

            <ScrollArea className={listHeight}>
              <div className={listClass}>
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
                {entries.map((entry) => {
                  const hint = folderHint(entry);
                  return (
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
                        {hint !== null && !entry.isGitRepo && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {hint}
                          </span>
                        )}
                      </button>
                      {/* A folder of repositories opens as a project too — that
                          is the multi-root case, not a wrong turn. */}
                      {isOpenable(entry) && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground outline-hidden hover:bg-elevate-strong hover:text-foreground focus:bg-elevate-strong focus:text-foreground"
                          onClick={() => void choose(entry.path)}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {data !== undefined && isOpenable(data) && (
              <div className={cn("shrink-0 border-t", listClass)}>
                <PathRow
                  icon={
                    data.isGitRepo ? (
                      <IconGitBranch className="size-4 h-lh shrink-0 text-muted-foreground" />
                    ) : (
                      <IconFolder className="size-4 h-lh shrink-0 text-muted-foreground" />
                    )
                  }
                  label={
                    data.isGitRepo
                      ? "Open this repository"
                      : `Open this folder — ${folderHint(data)}`
                  }
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
