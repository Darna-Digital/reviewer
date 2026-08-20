/**
 * The comment offer, for a selection the editor did not make itself.
 *
 * `@pierre/diffs` floats its own offer over a selection, but only over one the
 * *user* made with the pointer or the editor's own keys — a selection set
 * programmatically is deliberately left alone, which is right, or every jump to
 * a definition would offer to comment on where it landed.
 *
 * Vim's visual mode sets the selection programmatically: `viw` is a command this
 * app carries out with `setSelections`, so the editor never counts it as the
 * user's. The offer is rendered here instead, from the same state that draws
 * the mode indicator, so selecting a passage with the keyboard leads to a
 * comment the same way selecting it with the mouse does.
 */
import { IconMessage } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import type { VirtualAnchor } from "@/interactions/language/functions/anchors";

export function SelectionCommentPopover({
  anchor,
  onComment,
}: {
  /** Re-measured as the view moves, so the offer rides with the selection. */
  readonly anchor: () => VirtualAnchor | null;
  readonly onComment: () => void;
}) {
  return (
    <Popover open>
      <PopoverContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        // The selection is the subject: taking focus would collapse it, and
        // pressing here must not put the caret somewhere else either.
        initialFocus={false}
        finalFocus={false}
        onPointerDown={(event) => event.preventDefault()}
        className="w-auto gap-0 p-1"
      >
        <Button variant="ghost" size="xs" onClick={onComment}>
          <IconMessage /> Comment
        </Button>
      </PopoverContent>
    </Popover>
  );
}
