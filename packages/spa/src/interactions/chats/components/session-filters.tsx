/**
 * Narrowing the sessions list, from the sessions rail — beside the controls
 * that mint a session and find one, rather than on the list's own heading where
 * the two of them only appeared under the pointer.
 *
 * One control for both axes: the project the conversation was had in, and how
 * far back to look. The projects are searchable because the list spans all of
 * them at once, and there are as many of them as you have ever worked in — a
 * column of radio items is a list you scroll to find the one you meant.
 *
 * What is chosen is held in the filters store, so it survives opening a session
 * and coming back, and the list asks the server for it a page at a time. The
 * button carries a dot while anything is set: the list is never quietly
 * narrower than it looks. See `chatListFilters`.
 */
import { IconCheck, IconFilter2, IconFolder } from "@tabler/icons-react";
import { useState } from "react";
import { RailButton } from "@/components/layout/rail";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ROW_TOOLTIP_PLACEMENT,
  truncatedTooltipClass,
} from "@/components/ui/truncated-text";
import { ProjectAvatar } from "@/interactions/workspace/components/project-avatar";
import {
  setChatFilters,
  useChatFilters,
} from "@/interactions/chats/adapters/chat-filters.store";
import {
  ALL_PROJECTS,
  resolveProjectFilter,
  type ProjectFilter,
} from "@/interactions/chats/functions/chat-filters.functions";
import { DATE_FILTERS, type DateFilter } from "@/lib/date-filter";
import { displayPath } from "@/lib/display-path";
import { useChatProjects, useWorkspace } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { ChatProjectTally } from "@reviewer/core/chats";

const EMPTY_PROJECTS: ReadonlyArray<ChatProjectTally> = [];

const rowClass =
  "flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate";

/**
 * The mark a project is known by, so a row here reads the same as the project
 * chip in the window bar; "all projects" keeps the badge's shape so the names
 * stay in one column.
 */
function AllProjectsMark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-elevate text-muted-foreground">
      <IconFolder className="size-3" />
    </span>
  );
}

function FilterRow({
  selected,
  onSelect,
  tooltip,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  /** Shown beside the row on hover — a project's path, which no row can spell. */
  tooltip?: string;
  children: React.ReactNode;
}) {
  const check = (
    <IconCheck className={cn("size-3.5 shrink-0", !selected && "invisible")} />
  );

  if (tooltip === undefined) {
    return (
      <button type="button" onClick={onSelect} className={rowClass}>
        {check}
        {children}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" onClick={onSelect} className={rowClass} />
        }
      >
        {check}
        {children}
      </TooltipTrigger>
      <TooltipContent
        {...ROW_TOOLTIP_PLACEMENT}
        className={truncatedTooltipClass}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function SessionFilters() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const projectList = useChatProjects();
  const home = useWorkspace().data?.home;
  const projects = projectList.data ?? EMPTY_PROJECTS;
  const stored = useChatFilters();
  const project = resolveProjectFilter(projects, stored.project);
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const filtering = project !== ALL_PROJECTS || stored.date !== "all";

  const choose = (patch: { project?: ProjectFilter; date?: DateFilter }) => {
    setChatFilters(patch);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <RailButton label="Filter sessions" render={<PopoverTrigger />}>
        <IconFilter2 className="size-4" />
        {filtering && (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-brand-500" />
        )}
      </RailButton>
      {/* Hung off the rail rather than under it, as the search beside it is: the
          trigger is a column on the window's left edge. */}
      <PopoverContent
        side="right"
        align="start"
        className="w-72 gap-0 overflow-hidden p-0"
      >
        {projects.length > 1 && (
          <>
            <div className="border-b p-2">
              <Input
                autoFocus
                value={query}
                placeholder="Search projects"
                onChange={(e) => setQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <ScrollArea className="max-h-56" viewportClassName="scroll-fade">
              <div className="flex flex-col p-1.5">
                <FilterRow
                  selected={project === ALL_PROJECTS}
                  onSelect={() => choose({ project: ALL_PROJECTS })}
                >
                  <AllProjectsMark />
                  <span className="min-w-0 flex-1 truncate text-left">
                    All projects
                  </span>
                </FilterRow>
                {filtered.map((option) => (
                  <FilterRow
                    key={option.path}
                    selected={project === option.path}
                    onSelect={() => choose({ project: option.path })}
                    tooltip={displayPath(option.path, home)}
                  >
                    <ProjectAvatar name={option.name} />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {option.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {option.count}
                    </span>
                  </FilterRow>
                ))}
                {filtered.length === 0 && (
                  <p className="px-1.5 py-3 text-[13px] text-muted-foreground">
                    No projects match.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
        <div className="flex flex-col border-t p-1.5 first:border-t-0">
          {DATE_FILTERS.map((option) => (
            <FilterRow
              key={option.value}
              selected={stored.date === option.value}
              onSelect={() => choose({ date: option.value })}
            >
              <span className="min-w-0 flex-1 truncate text-left">
                {option.label}
              </span>
            </FilterRow>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
