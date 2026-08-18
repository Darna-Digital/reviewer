/**
 * The way from reading a change to running it.
 *
 * A worktree is deliberately not somewhere the app takes you when its task
 * starts — the work happens beside you and is read from where you stand. But
 * reading is not the whole of a review: at some point you want the thing on
 * screen, and that means terminals, services and the dev server pointing at the
 * tree the change is in. So the trail that names what you are reading ends with
 * the offer to go and work there.
 *
 * Only ever an offer to move: standing in the tree already is the ordinary
 * case, and a disabled button reporting it is a word about nothing on the one
 * line of the app that has to stay readable.
 */
import { IconArrowBarToRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CheckoutButton({
  branch,
  busy,
  onOpen,
}: {
  /** The branch of the tree this leads to — what the tooltip names. */
  branch: string;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        // A disabled button answers nothing, so the reason is wrapped around it
        // rather than hidden inside it.
        render={<span className="shrink-0" />}
      >
        <Button
          variant="ghost"
          size="xs"
          disabled={busy}
          onClick={onOpen}
          className="text-muted-foreground"
        >
          <IconArrowBarToRight />
          Check out
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {`Work in ‘${branch}’ — terminals, services and the dev server move there, so you can run the change.`}
      </TooltipContent>
    </Tooltip>
  );
}
