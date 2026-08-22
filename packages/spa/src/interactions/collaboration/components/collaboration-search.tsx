/**
 * The workspace search pill in the title bar. It opens onto everything the
 * sidebar holds — projects and tasks — and jumps straight there.
 */
import { IconSearch } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  PROJECTS,
  allTasks,
  type CollaborationView,
} from "@/interactions/collaboration/data/collaboration.mock";

interface Hit {
  key: string;
  view: CollaborationView;
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
}

export function CollaborationSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const hits: ReadonlyArray<Hit> = [
    ...PROJECTS.map((p) => ({
      key: `project-${p.id}`,
      view: "project" as const,
      id: p.id,
      label: p.name,
      detail: "Project",
      icon: (
        <span
          className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
          style={{ "--mark": p.color } as CSSProperties}
        />
      ),
    })),
    ...allTasks().map((t) => ({
      key: `task-${t.id}`,
      view: "task" as const,
      id: t.id,
      label: t.title,
      detail: t.key,
      icon: <TaskStatusIcon status={t.status} />,
    })),
  ].filter(
    (hit) =>
      q.length === 0 ||
      hit.label.toLowerCase().includes(q) ||
      hit.detail.toLowerCase().includes(q)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Search"
                  className="rounded-lg text-muted-foreground"
                />
              }
            />
          }
        >
          <IconSearch className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Search</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-96 gap-0 overflow-hidden p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            placeholder="Search projects and tasks"
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-80" viewportClassName="scroll-fade">
          <div className="flex flex-col p-1.5">
            {hits.slice(0, 12).map((hit) => (
              <Link
                key={hit.key}
                to="/modes/experimentation/collaboration"
                search={{ view: hit.view, id: hit.id }}
                onClick={() => setOpen(false)}
                className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
              >
                {hit.icon}
                <span className="min-w-0 flex-1 truncate">{hit.label}</span>
                <span className="shrink-0 truncate text-xs text-muted-foreground">
                  {hit.detail}
                </span>
              </Link>
            ))}
            {hits.length === 0 && (
              <p className="px-1.5 py-3 text-[13px] text-muted-foreground">
                Nothing matches.
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
