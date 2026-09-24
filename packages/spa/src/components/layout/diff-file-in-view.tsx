/**
 * The file the diff is scrolled to, named at the head of the chrome row that
 * carries the layout toggle: its icon, then the path. The folders give way
 * first when the row is short; the name at the end is what tells one file from
 * the next, so it keeps its room.
 *
 * Pressing it opens the file itself on the browse page, the way a row of the
 * browse tree does — and the diff's own "Edit" — and as with the tree's rows
 * and the tabs the file is prerendered under the pointer, so it paints
 * coloured on its first frame.
 *
 * The name simply changes as the scroll carries the pane into the next file.
 * It used to slide in from the side the reader had come from, but the change
 * lands on every scroll frame that crosses a file boundary, and an animation
 * restarting that often read as a stutter rather than a cue.
 */
import { useNavigate } from "@tanstack/react-router";
import { usePrerenderFile } from "@/components/editor/prerender";
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

export function HeaderDiffFileInView({ route }: { route: ShellRoute }) {
  const shown = useShowsDiffStyleToggle(route);
  const inView = useDiffFileInView();
  const navigate = useNavigate();
  const prerenderFile = usePrerenderFile();

  if (!shown || inView === null) return null;
  const { path } = inView;
  const name = pathName(path);
  const folders = path.slice(0, path.length - name.length);
  const open = () =>
    void navigate({ to: "/modes/code/browse", search: { file: path } });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={open}
            onPointerEnter={() => prerenderFile(path)}
          />
        }
        className="flex h-7 min-w-0 cursor-default items-center overflow-hidden rounded-md px-1.5 text-[0.8125rem] outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <FileTypeIcon path={path} className="mr-1.5 size-3.5" />
        <span className="min-w-0 truncate text-muted-foreground">
          {folders}
        </span>
        <span className="shrink-0 text-foreground">{name}</span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-none whitespace-nowrap"
      >
        {path}
      </TooltipContent>
    </Tooltip>
  );
}
