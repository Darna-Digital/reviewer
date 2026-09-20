/**
 * The file the diff is scrolled to, named at the head of the chrome row that
 * carries the layout toggle: its icon, then the path. The folders give way
 * first when the row is short; the name at the end is what tells one file from
 * the next, so it keeps its room.
 *
 * As the scroll carries the pane into the next file the name swings in from
 * below, and from above when it goes back up — the direction the reader just
 * moved — so the change is seen rather than merely noticed.
 */
import { useEffect, useRef } from "react";
import { useShowsDiffStyleToggle } from "@/components/layout/diff-style-toggle";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiffFileInView } from "@/interactions/diff/adapters/diff-file-in-view.store";
import { pathName } from "@/lib/display-path";
import type { ShellRoute } from "@/lib/shell-route";
import { cn } from "@/lib/utils";

export function HeaderDiffFileInView({ route }: { route: ShellRoute }) {
  const shown = useShowsDiffStyleToggle(route);
  const inView = useDiffFileInView();
  // The index the last name came from, so this one knows which way to arrive.
  const lastIndex = useRef<number | null>(null);
  const fromBelow =
    lastIndex.current === null ||
    inView === null ||
    inView.index >= lastIndex.current;
  useEffect(() => {
    lastIndex.current = inView?.index ?? null;
  }, [inView]);

  if (!shown || inView === null) return null;
  const name = pathName(inView.path);
  const folders = inView.path.slice(0, inView.path.length - name.length);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div />}
        className="flex h-7 min-w-0 cursor-default items-center overflow-hidden px-1.5 text-[0.8125rem] select-none"
      >
        <span
          key={inView.path}
          className={cn(
            "flex min-w-0 animate-in items-center duration-200 fade-in motion-reduce:animate-none",
            fromBelow ? "slide-in-from-bottom-1" : "slide-in-from-top-1"
          )}
        >
          <FileTypeIcon path={inView.path} className="mr-1.5 size-3.5" />
          <span className="min-w-0 truncate text-muted-foreground">
            {folders}
          </span>
          <span className="shrink-0 text-foreground">{name}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-none whitespace-nowrap"
      >
        {inView.path}
      </TooltipContent>
    </Tooltip>
  );
}
