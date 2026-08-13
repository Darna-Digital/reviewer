/**
 * The session search pill in the title bar — the same gesture and the same
 * shape code and collaboration modes use, rather than a box on permanent
 * display in the sidebar. It searches titles and last messages — the pair the
 * old inline filter matched on — and, now that sessions from every project are
 * in one list, the project name too, so "api" finds that project's sessions
 * without first narrowing the sidebar to it.
 */
import { IconSearch } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { useChats } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";

const MAX_HITS = 12;

export function SessionSearch() {
  const chats = useChats();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sessions = chats.data ?? [];
  const q = query.trim().toLowerCase();
  const hits =
    q.length === 0
      ? sessions
      : sessions.filter((c) =>
          `${c.title}\n${c.lastMessage ?? ""}\n${c.origin.projectName}`
            .toLowerCase()
            .includes(q)
        );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Search sessions"
                  className="rounded-lg text-muted-foreground"
                />
              }
            />
          }
        >
          <IconSearch className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Search sessions</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-96 gap-0 overflow-hidden p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            placeholder="Search sessions"
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-80" viewportClassName="scroll-fade">
          <div className="flex flex-col p-1.5">
            {hits.slice(0, MAX_HITS).map((hit) => (
              <Link
                key={hit.id}
                to="/modes/agent-session/$chatId"
                params={{ chatId: hit.id }}
                onClick={() => setOpen(false)}
                className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
              >
                <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  title={hit.origin.projectPath}
                >
                  {hit.origin.projectName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(hit.updatedAt)}
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
