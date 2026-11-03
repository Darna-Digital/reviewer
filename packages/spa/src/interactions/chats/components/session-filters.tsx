/**
 * Narrowing the sessions list, from the sessions rail — beside the controls
 * that mint a session and find one, rather than on the list's own heading where
 * the two of them only appeared under the pointer.
 *
 * One control for both axes: where the conversation was had — a saved
 * workspace, or a repository whether opened alone or inside one — and how far
 * back to look. The places are searchable because the list spans all of them at
 * once, and there are as many of them as you have ever worked in — a column of
 * radio items is a list you scroll to find the one you meant.
 *
 * What is chosen is held in the filters store, so it survives opening a session
 * and coming back, and the list asks the server for it a page at a time. The
 * button carries a dot while anything is set: the list is never quietly
 * narrower than it looks. See `chatListFilters`.
 */
import {
  IconCheck,
  IconFilter2,
  IconFolder,
  IconStack2,
} from "@tabler/icons-react";
import { useState } from "react";
import { RailButton, revealSidebar } from "@/components/layout/rail";
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
  ALL_PLACES,
  resolvePlaceFilter,
  samePlace,
  type PlaceFilter,
} from "@/interactions/chats/functions/chat-filters.functions";
import { DATE_FILTERS, type DateFilter } from "@/lib/date-filter";
import { displayPath } from "@/lib/display-path";
import { NO_PLACES, useChatPlaces, useWorkspace } from "@/lib/queries";
import { cn } from "@/lib/utils";

const rowClass =
  "flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate";

const groupLabelClass =
  "px-1.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground";

/**
 * The badge-shaped marks of the rows without an avatar of their own, so the
 * names stay in one column beside the repositories' avatars — the same as the
 * project chip in the window bar.
 */
function PlaceMark({ icon: Icon }: { icon: typeof IconFolder }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-elevate text-muted-foreground">
      <Icon className="size-3" />
    </span>
  );
}

function PlaceCount({ count }: { count: number }) {
  return (
    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
      {count}
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
  const places = useChatPlaces().data ?? NO_PLACES;
  const home = useWorkspace().data?.home;
  const stored = useChatFilters();
  const place = resolvePlaceFilter(places, stored.place);
  const needle = query.trim().toLowerCase();
  const workspaces = places.workspaces.filter((w) =>
    w.name.toLowerCase().includes(needle)
  );
  const repos = places.repos.filter(
    (r) =>
      r.name.toLowerCase().includes(needle) ||
      displayPath(r.path, home).toLowerCase().includes(needle)
  );
  const hasPlaces = places.workspaces.length + places.repos.length > 1;
  const filtering = place.kind !== "all" || stored.date !== "all";

  const choose = (patch: { place?: PlaceFilter; date?: DateFilter }) => {
    setChatFilters(patch);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
        // Narrowing a list you cannot see is a control with nothing under it,
        // so reaching for it brings the list back.
        else revealSidebar();
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
        {hasPlaces && (
          <>
            <div className="border-b p-2">
              <Input
                autoFocus
                value={query}
                placeholder="Search workspaces and repositories"
                onChange={(e) => setQuery(e.target.value)}
                className="h-8"
              />
            </div>
            <ScrollArea className="max-h-72" viewportClassName="scroll-fade">
              <div className="flex flex-col p-1.5">
                <FilterRow
                  selected={place.kind === "all"}
                  onSelect={() => choose({ place: ALL_PLACES })}
                >
                  <PlaceMark icon={IconFolder} />
                  <span className="min-w-0 flex-1 truncate text-left">
                    Everywhere
                  </span>
                </FilterRow>
                {workspaces.length > 0 && (
                  <p className={groupLabelClass}>Workspaces</p>
                )}
                {workspaces.map((option) => {
                  const choice: PlaceFilter = {
                    kind: "workspace",
                    id: option.id,
                  };
                  return (
                    <FilterRow
                      key={option.id}
                      selected={samePlace(place, choice)}
                      onSelect={() => choose({ place: choice })}
                    >
                      <PlaceMark icon={IconStack2} />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {option.name}
                      </span>
                      <PlaceCount count={option.count} />
                    </FilterRow>
                  );
                })}
                {repos.length > 0 && (
                  <p className={groupLabelClass}>Repositories</p>
                )}
                {repos.map((option) => {
                  const choice: PlaceFilter = {
                    kind: "repo",
                    path: option.path,
                  };
                  return (
                    <FilterRow
                      key={option.path}
                      selected={samePlace(place, choice)}
                      onSelect={() => choose({ place: choice })}
                      tooltip={displayPath(option.path, home)}
                    >
                      <ProjectAvatar name={option.name} />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {option.name}
                      </span>
                      <PlaceCount count={option.count} />
                    </FilterRow>
                  );
                })}
                {workspaces.length === 0 && repos.length === 0 && (
                  <p className="px-1.5 py-3 text-[13px] text-muted-foreground">
                    Nothing matches.
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
