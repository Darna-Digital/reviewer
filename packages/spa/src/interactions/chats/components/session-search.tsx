/**
 * Finding a session, from the sessions rail — a gesture, as searching is
 * everywhere else, rather than a box on permanent display in the sidebar.
 * It searches titles and last messages — the pair the old inline filter matched
 * on — and, now that sessions from every project are in one list, the project
 * name too, so "api" finds that project's sessions without first narrowing the
 * sidebar to it.
 *
 * The search is the server's, over every session. The sidebar holds only the
 * pages it has been scrolled through, so a search run against what the client
 * had would go quiet on exactly the old conversations this is for — and the
 * message it matches is the whole message, not the clipped preview the row
 * shows. Hits keep showing while the next answer is in flight, so typing
 * narrows a list rather than blinking an empty one between keystrokes.
 */
import { IconSearch } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { RailButton } from "@/components/layout/rail";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatSearch } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";

export function SessionSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useChatSearch(query, open);
  const hits = results.data?.items ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <RailButton label="Search sessions" render={<PopoverTrigger />}>
        <IconSearch className="size-4" />
      </RailButton>
      {/* Hung off the rail rather than under it: the trigger is a column on the
          window's left edge, so the list opens beside it, aligned to its top. */}
      <PopoverContent
        side="right"
        align="start"
        className="w-96 gap-0 overflow-hidden p-0"
      >
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
            {hits.map((hit) => (
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
